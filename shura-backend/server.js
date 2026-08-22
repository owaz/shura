// server.js — Shura Backend with PostgreSQL
require('dotenv').config();
const { useAzureMonitor } = require('@azure/monitor-opentelemetry');
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
const pool = require('./db'); // Import pool from db/index.js
const { authenticateToken } = require('./middleware/auth');
const { verifyAccessToken } = require('./middleware/auth');
const { assertEmailConfiguration } = require('./utils/emailConfig');
const { assertProductionOrigins, isAllowedOrigin } = require('./utils/originPolicy');

if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
  useAzureMonitor();
  console.log('✅ Azure Application Insights enabled');
}

console.log('🚀 Starting Shura Backend...');
console.log('Node version:', process.version);

// Express setup
const app = express();
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}
const server = http.createServer(app);

assertProductionOrigins();

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error('CORS not allowed by server'), false);
    },
    credentials: false,
  }
});
app.set('io', io);

// Socket.io authentication middleware
io.use(async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split?.(' ')?.[1];
    if (!token) return next(new Error('Authentication required'));

    socket.user = await verifyAccessToken(token);
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
  res.setHeader('Content-Security-Policy', "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self' https://checkout.razorpay.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https: wss:; frame-src https://api.razorpay.com https://checkout.razorpay.com https://*.auth0.com; form-action 'self' https://*.auth0.com");
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});
app.use(express.json({
  limit: '1mb',
  verify: (req, res, buf) => {
    if (req.originalUrl === '/api/payments/webhook' || req.originalUrl.startsWith('/api/webhooks/resend')) {
      req.rawBody = buf;
    }
  }
}));


// Improved CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) return callback(null, true);

    return callback(new Error('CORS not allowed by server'), false);
  },
  credentials: false,
}));

console.log('✅ CORS enabled for explicitly configured origins and local development origins');

// Rate limiting
const limiterDefaults = { standardHeaders: true, legacyHeaders: false };
// Portal navigation fans out across several read-only endpoints. Keep a broad
// abuse ceiling here while sensitive mutations retain their tighter limiters.
const generalLimiter = rateLimit({ ...limiterDefaults, windowMs: 15 * 60 * 1000, max: 600 });
const paymentLimiter = rateLimit({
  ...limiterDefaults,
  windowMs: 15 * 60 * 1000,
  max: 200,
  skip: (req) => req.originalUrl === '/api/payments/webhook',
});
const authLimiter = rateLimit({ ...limiterDefaults, windowMs: 15 * 60 * 1000, max: 60 });
const uploadLimiter = rateLimit({ ...limiterDefaults, windowMs: 60 * 60 * 1000, max: 30 });
const newsletterLimiter = rateLimit({ ...limiterDefaults, windowMs: 60 * 60 * 1000, max: 20 });
const intakeLimiter = rateLimit({ ...limiterDefaults, windowMs: 15 * 60 * 1000, max: 50 });
const webhookLimiter = rateLimit({ ...limiterDefaults, windowMs: 15 * 60 * 1000, max: 600 });

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
app.use('/api/therapist/intake', generalLimiter, authenticateToken, therapistIntakeRoutes);

const adminRoutes = require('./routes/admin');
app.use('/api/admin', generalLimiter, adminRoutes);

const adminAuthRoutes = require('./routes/adminAuth');
app.use('/api/admin/auth', authLimiter, adminAuthRoutes);

// Dev routes are never composed into the production application.
if (process.env.NODE_ENV !== 'production') {
  try {
    const devRoutes = require('./routes/dev');
    app.use('/api/dev', devRoutes);
  } catch (_error) {
    console.warn('Dev routes not loaded');
  }
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
app.use('/api/payments/webhook', webhookLimiter);
if (paymentRoutes) app.use('/api/payments', paymentLimiter, paymentRoutes);
const resendWebhookRoutes = require('./routes/resendWebhook');
app.use('/api/webhooks/resend', webhookLimiter, resendWebhookRoutes);

const calendarRoutes = require('./routes/calendar');
if (calendarRoutes) app.use('/api/calendar', generalLimiter, calendarRoutes);

const clientPortalRoutes = require('./routes/client');
app.use('/api/client', generalLimiter, clientPortalRoutes);

const platformRoutes = require('./routes/platform');
app.use('/api/platform', generalLimiter, platformRoutes);

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
    console.error('Database diagnostic failed', { code: err?.code || 'DB_TIME_FAILED' });
    res.status(503).json({ ok: false, error: 'Database unavailable' });
  }
});

// Serve frontend static files in production
if (process.env.NODE_ENV === 'production') {
  const path = require('path');
  const publicPath = path.join(__dirname, 'public');
  app.use(express.static(publicPath));
  // SPA fallback — serve index.html for non-API routes
  // Express 5 requires named params: {*splat} instead of bare *
  app.get('{*splat}', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(publicPath, 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled request error', { code: err?.code || 'INTERNAL_SERVER_ERROR' });
  if (err.message === 'CORS not allowed by server') {
    return res.status(403).json({ error: { code: 'CORS_DENIED', message: 'CORS policy violation', details: null } });
  }
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.expose ? err.message : 'Internal Server Error',
      details: err.details || null,
    },
  });
});

// Socket.io signaling handlers for WebRTC
io.on('connection', (socket) => {
  const userRoom = `user:${socket.user.role}:${socket.user.id}`;
  socket.join(userRoom);
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
    await pool.query("ALTER TABLE therapists ADD COLUMN IF NOT EXISTS profile_image_url TEXT");
    await pool.query("ALTER TABLE therapists ADD COLUMN IF NOT EXISTS bio TEXT");
    await pool.query("ALTER TABLE therapists ADD COLUMN IF NOT EXISTS languages TEXT[]");
    await pool.query("ALTER TABLE therapists ADD COLUMN IF NOT EXISTS gender VARCHAR(20)");
    await pool.query("ALTER TABLE therapists ADD COLUMN IF NOT EXISTS location VARCHAR(255)");
    await pool.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_role VARCHAR(20) DEFAULT 'client'");
    await pool.query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS client_id INTEGER");
    await pool.query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount_cents INTEGER");
    await pool.query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(255)");
    await pool.query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(255)");
    await pool.query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP");
    await pool.query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()");
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
    await pool.query(`CREATE TABLE IF NOT EXISTS payment_booking_intents (
      id SERIAL PRIMARY KEY,
      order_id VARCHAR(255) UNIQUE NOT NULL,
      client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      therapist_id INTEGER NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
      booking_date DATE NOT NULL,
      booking_time VARCHAR(10) NOT NULL,
      session_type VARCHAR(50) NOT NULL DEFAULT 'video',
      amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
      booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
      payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'initiated',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_payment_booking_intents_client ON payment_booking_intents(client_id, created_at DESC)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_payment_booking_intents_status ON payment_booking_intents(status)');
    await pool.query(`CREATE TABLE IF NOT EXISTS razorpay_webhook_events (
      event_id VARCHAR(255) PRIMARY KEY,
      event_type VARCHAR(120) NOT NULL,
      payload JSONB NOT NULL,
      received_at TIMESTAMP DEFAULT NOW()
    )`);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_razorpay_webhook_events_received_at ON razorpay_webhook_events(received_at DESC)');
    // Add other lightweight migration steps here if needed in future
    console.log('✅ Startup migrations applied');
  } catch (err) {
    console.error('Startup compatibility check error', { code: err?.code || 'STARTUP_SCHEMA_FAILED' });
    if (process.env.NODE_ENV === 'production') {
      throw err;
    }
    // Don't crash the server for migration failures in dev; continue and let endpoints handle errors
  }
}

(async () => {
  assertEmailConfiguration();
  await runStartupMigrations();
  const emailWorker = require('./utils/emailWorker').startEmailWorker();
  server.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`🌐 http://localhost:${PORT}/api/health`);
    console.log('🔌 WebSocket server running');
  });

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received; draining email worker`);
    if (emailWorker) await emailWorker.stop();
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  };
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
})();
