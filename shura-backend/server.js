// server.js — Shura Backend with PostgreSQL
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const pool = require('./db'); // Import pool from db/index.js
const { authenticateToken } = require('./middleware/auth');
const { ACCESS_COOKIE, getJwtSecret, parseCookies } = require('./utils/sessionAuth');

console.log('🚀 Starting Shura Backend...');
console.log('Node version:', process.version);

// Express setup
const app = express();
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}
const server = http.createServer(app);

const configuredOrigins = () => {
  const envOrigins = [
    process.env.FRONTEND_URLS,
    process.env.FRONTEND_URL,
    process.env.ALLOWED_ORIGINS,
  ]
    .filter(Boolean)
    .flatMap((value) => value.split(',').map((origin) => origin.trim()).filter(Boolean));

  return [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3003',
    'http://localhost:3005',
    'http://localhost:3006',
    ...envOrigins,
  ];
};

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: configuredOrigins(),
    credentials: true,
  }
});
app.set('io', io);

// Socket.io authentication middleware
io.use(async (socket, next) => {
  try {
    const cookies = parseCookies(socket.handshake.headers?.cookie || '');
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split?.(' ')[1] || cookies[ACCESS_COOKIE];
    if (!token) return next(new Error('Authentication required'));

    const user = jwt.verify(token, getJwtSecret());
    if (user.sid) {
      const { rows } = await pool.query(
        'SELECT id FROM auth_sessions WHERE id = $1 AND revoked_at IS NULL AND expires_at > NOW()',
        [user.sid]
      );
      if (!rows.length) return next(new Error('Session expired or revoked'));
    }

    socket.user = user;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});

// Middleware
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');
  next();
});
app.use(express.json({
  limit: '1mb',
  verify: (req, res, buf) => {
    if (req.originalUrl === '/api/payments/webhook') {
      req.rawBody = buf;
    }
  }
}));


// Improved CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Allow all localhost and 127.0.0.1 ports in development
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }

    // Allow custom origins from env
    const allowedOrigins = configuredOrigins();
    if (allowedOrigins.includes(origin)) return callback(null, true);

    return callback(new Error('CORS not allowed by server'), false);
  },
  credentials: true,
}));

console.log('✅ CORS enabled for all localhost, 127.0.0.1, and custom env origins');

// Rate limiting
const limiterDefaults = { standardHeaders: true, legacyHeaders: false };
const generalLimiter = rateLimit({ ...limiterDefaults, windowMs: 15 * 60 * 1000, max: 200 });
const authLimiter = rateLimit({ ...limiterDefaults, windowMs: 15 * 60 * 1000, max: 60 });
const uploadLimiter = rateLimit({ ...limiterDefaults, windowMs: 60 * 60 * 1000, max: 30 });
const newsletterLimiter = rateLimit({ ...limiterDefaults, windowMs: 60 * 60 * 1000, max: 20 });
const intakeLimiter = rateLimit({ ...limiterDefaults, windowMs: 15 * 60 * 1000, max: 50 });

// Routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authLimiter, authRoutes);

const uploadRoutes = require('./routes/upload');
app.use('/api/upload', uploadLimiter, uploadRoutes);

const newsletterRoutes = require('./routes/newsletter');
app.use('/api/newsletter', newsletterLimiter, newsletterRoutes);

const intakeRoutes = require('./routes/intake');
const therapistIntakeRoutes = require('./routes/therapist-intake');
app.use('/api/intake', intakeLimiter, intakeRoutes);
app.use('/api/therapist/intake', authenticateToken, therapistIntakeRoutes);

const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

const adminAuthRoutes = require('./routes/adminAuth');
app.use('/api/admin/auth', authLimiter, adminAuthRoutes);

// Dev routes (local-only helpers)
try {
  const devRoutes = require('./routes/dev');
  app.use('/api/dev', devRoutes);
} catch (e) {
  console.warn('Dev routes not loaded:', e.message || e);
}

const chatRoutes = require('./routes/chats');
if (chatRoutes) app.use('/api/chats', generalLimiter, chatRoutes);


// const sessionsRoutes = require('./routes/sessions');
// if (sessionsRoutes) app.use('/api/sessions', generalLimiter, sessionsRoutes);

const callRoutes = require('./routes/calls');
if (callRoutes) app.use('/api/calls', generalLimiter, callRoutes);

const bookingRoutes = require('./routes/bookings');
if (bookingRoutes) app.use('/api/bookings', generalLimiter, bookingRoutes);

const paymentRoutes = require('./routes/payments');
if (paymentRoutes) app.use('/api/payments', generalLimiter, paymentRoutes);

const calendarRoutes = require('./routes/calendar');
if (calendarRoutes) app.use('/api/calendar', generalLimiter, calendarRoutes);

// Health check endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Shura API is running' });
});

app.get('/ping', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.get('/db-time', async (req, res) => {
  try {
    const r = await pool.query('SELECT NOW() AS now');
    res.json({ ok: true, db_time: r.rows[0].now });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Serve frontend static files in production
if (process.env.NODE_ENV === 'production') {
  const path = require('path');
  const publicPath = path.join(__dirname, 'public');
  app.use(express.static(publicPath));
  // SPA fallback — serve index.html for non-API routes
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(publicPath, 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  if (err.message === 'CORS not allowed by server') {
    return res.status(403).json({ error: 'CORS policy violation' });
  }
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

// Socket.io signaling handlers for WebRTC
io.on('connection', (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  const userRoom = `user:${socket.user.role}:${socket.user.id}`;
  socket.join(userRoom);

  // Therapist/Client call signaling
  socket.on('call-offer', ({ to, offer, callType }) => {
    console.log(`📞 Call offer from ${socket.id} to ${to} (${callType})`);
    io.emit('call-offer', { from: socket.id, offer, callType });
  });

  socket.on('call-answer', ({ to, answer }) => {
    console.log(`📞 Call answer from ${socket.id} to ${to}`);
    io.emit('call-answer', { from: socket.id, answer });
  });

  socket.on('ice-candidate', ({ to, candidate }) => {
    console.log(`🧊 ICE candidate from ${socket.id} to ${to}`);
    io.emit('ice-candidate', { from: socket.id, candidate });
  });

  socket.on('call-end', ({ to }) => {
    console.log(`📴 Call ended by ${socket.id} to ${to}`);
    io.emit('call-end', { from: socket.id });
  });

  socket.on('join_call', ({ roomId }) => {
    socket.join(roomId);
    socket.to(roomId).emit('peer_joined', { socketId: socket.id });
    console.log(`User ${socket.id} joined call ${roomId}`);
  });

  socket.on('leave_call', ({ roomId }) => {
    socket.leave(roomId);
    socket.to(roomId).emit('peer_left', { socketId: socket.id });
    console.log(`User ${socket.id} left call ${roomId}`);
  });

  // Offer/Answer exchange (legacy)
  socket.on('webrtc_offer', ({ roomId, sdp, to }) => {
    if (to) {
      socket.to(to).emit('webrtc_offer', { from: socket.id, sdp });
    } else {
      socket.to(roomId).emit('webrtc_offer', { from: socket.id, sdp });
    }
  });

  socket.on('webrtc_answer', ({ roomId, sdp, to }) => {
    if (to) {
      socket.to(to).emit('webrtc_answer', { from: socket.id, sdp });
    } else {
      socket.to(roomId).emit('webrtc_answer', { from: socket.id, sdp });
    }
  });

  socket.on('webrtc_ice_candidate', ({ roomId, candidate, to }) => {
    if (to) {
      socket.to(to).emit('webrtc_ice_candidate', { from: socket.id, candidate });
    } else {
      socket.to(roomId).emit('webrtc_ice_candidate', { from: socket.id, candidate });
    }
  });

  socket.on('disconnect', (reason) => {
    console.log(`🔌 Socket disconnected: ${socket.id} (${reason})`);
  });
});

// Start server (http + socket.io)
const PORT = process.env.PORT || 5000;

// Run lightweight migrations/compat checks before starting the server
async function runStartupMigrations() {
  try {
    // Ensure the users table has profile-related columns used by frontend
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture TEXT');
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(255)");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS spiritual_integration INTEGER DEFAULT 7");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(50) DEFAULT 'English'");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Asia/Kolkata'");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS focus_areas TEXT");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT true");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS sms_notifications BOOLEAN DEFAULT false");
    await pool.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_role VARCHAR(20) DEFAULT 'client'");
    await pool.query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS client_id INTEGER");
    await pool.query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount_cents INTEGER");
    await pool.query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(255)");
    await pool.query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(255)");
    await pool.query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP");
    await pool.query(`CREATE TABLE IF NOT EXISTS auth_sessions (
      id VARCHAR(64) PRIMARY KEY,
      user_id INTEGER NOT NULL,
      role VARCHAR(20) NOT NULL CHECK (role IN ('client', 'therapist')),
      refresh_token_hash TEXT NOT NULL,
      csrf_token TEXT NOT NULL,
      user_agent TEXT,
      ip_address TEXT,
      expires_at TIMESTAMP NOT NULL,
      revoked_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      last_used_at TIMESTAMP DEFAULT NOW()
    )`);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_role ON auth_sessions(user_id, role)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_auth_sessions_valid ON auth_sessions(id) WHERE revoked_at IS NULL');
    await pool.query(`CREATE TABLE IF NOT EXISTS therapist_availability_rules (
      id SERIAL PRIMARY KEY,
      therapist_id INTEGER NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
      day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      slot_minutes INTEGER NOT NULL DEFAULT 30 CHECK (slot_minutes BETWEEN 15 AND 240),
      timezone VARCHAR(80) NOT NULL DEFAULT 'Asia/Kolkata',
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(therapist_id, day_of_week)
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS therapist_blocked_times (
      id SERIAL PRIMARY KEY,
      therapist_id INTEGER NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
      starts_at TIMESTAMPTZ NOT NULL,
      ends_at TIMESTAMPTZ NOT NULL,
      reason TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      CHECK (ends_at > starts_at)
    )`);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_therapist_blocked_times_range ON therapist_blocked_times(therapist_id, starts_at, ends_at)');
    await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_no_double_booking ON bookings(therapist_id, date, time) WHERE status != 'cancelled'");
    await pool.query(`CREATE TABLE IF NOT EXISTS therapist_calendar_integrations (
      id SERIAL PRIMARY KEY,
      therapist_id INTEGER NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
      provider VARCHAR(30) NOT NULL,
      provider_account_id TEXT,
      provider_account_email TEXT,
      access_token_enc TEXT,
      refresh_token_enc TEXT,
      scopes TEXT,
      expires_at TIMESTAMP,
      status VARCHAR(30) DEFAULT 'connected',
      last_error TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(therapist_id, provider)
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS booking_calendar_events (
      id SERIAL PRIMARY KEY,
      booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      integration_id INTEGER NOT NULL REFERENCES therapist_calendar_integrations(id) ON DELETE CASCADE,
      provider VARCHAR(30) NOT NULL,
      provider_event_id TEXT,
      provider_event_url TEXT,
      sync_status VARCHAR(30) DEFAULT 'pending',
      last_error TEXT,
      synced_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(booking_id, integration_id)
    )`);
    // Add other lightweight migration steps here if needed in future
    console.log('✅ Startup migrations applied');
  } catch (err) {
    console.error('Startup migration error:', err);
    if (process.env.NODE_ENV === 'production') {
      throw err;
    }
    // Don't crash the server for migration failures in dev; continue and let endpoints handle errors
  }
}

(async () => {
  await runStartupMigrations();
  server.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`🌐 http://localhost:${PORT}/api/health`);
    console.log('🔌 WebSocket server running');
  });
})();
