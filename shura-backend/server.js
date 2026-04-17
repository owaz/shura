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

console.log('🚀 Starting Shura Backend...');
console.log('Node version:', process.version);

// Express setup
const app = express();
const server = http.createServer(app);

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3001', 'http://localhost:3003', 'http://localhost:3005', process.env.FRONTEND_URL].filter(Boolean),
    credentials: true,
  }
});

// Socket.io authentication middleware (optional token)
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split?.(' ')[1];
  if (!token) return next(); // allow anonymous for now
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return next(new Error('Invalid token'));
    socket.user = user;
    next();
  });
});

// Middleware
app.use(express.json());


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
    const allowedOriginsEnv = process.env.FRONTEND_URLS || process.env.FRONTEND_URL || '';
    const allowedOrigins = allowedOriginsEnv.split(',').map(s => s.trim()).filter(Boolean);
    if (allowedOrigins.includes(origin)) return callback(null, true);

    return callback(new Error('CORS not allowed by server'), false);
  },
  credentials: true,
}));

console.log('✅ CORS enabled for all localhost, 127.0.0.1, and custom env origins');

// Rate limiting
const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });

// Routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

const uploadRoutes = require('./routes/upload');
app.use('/api/upload', uploadRoutes);

const newsletterRoutes = require('./routes/newsletter');
app.use('/api/newsletter', newsletterRoutes);

const intakeRoutes = require('./routes/intake');
const therapistIntakeRoutes = require('./routes/therapist-intake');
app.use('/api/intake', intakeRoutes);
app.use('/api/therapist/intake', authenticateToken, therapistIntakeRoutes);

const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

const adminAuthRoutes = require('./routes/adminAuth');
app.use('/api/admin/auth', adminAuthRoutes);

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
    // Add other lightweight migration steps here if needed in future
    console.log('✅ Startup migrations applied');
  } catch (err) {
    console.error('Startup migration error:', err);
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
