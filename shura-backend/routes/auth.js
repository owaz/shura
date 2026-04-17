const express = require('express');
const argon2 = require('argon2');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db'); // Properly import the pool
const { sendTherapistApplicationNotification, sendClientSignupNotification } = require('../utils/emailService');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'shura_super_secret_jwt_key_2024';
const SALT_ROUNDS = 10;

const crypto = require('crypto');

// --- Profile routes for clients ---
// Get current user's profile
router.get('/profile', require('../middleware/auth').authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { rows } = await pool.query('SELECT id, email, full_name, phone, dob, profile_picture, display_name, bio, spiritual_integration, preferred_language, timezone, focus_areas, email_notifications, sms_notifications, created_at FROM users WHERE id = $1', [userId]);
    if (!rows.length) return res.status(404).json({ error: 'Profile not found' });
    return res.json({ user: rows[0] });
  } catch (err) {
    console.error('GET /profile error', err);
    return res.status(500).json({ error: err.message });
  }
});

// Update current user's profile
router.put('/profile', require('../middleware/auth').authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { full_name, phone, dob, profile_picture, display_name, bio, spiritual_integration, preferred_language, timezone, focus_areas, email_notifications, sms_notifications } = req.body;
    const { rows } = await pool.query(
      'UPDATE users SET full_name = $1, phone = $2, dob = $3, profile_picture = $4, display_name = $5, bio = $6, spiritual_integration = $7, preferred_language = $8, timezone = $9, focus_areas = $10, email_notifications = $11, sms_notifications = $12, updated_at = NOW() WHERE id = $13 RETURNING id, email, full_name, phone, dob, profile_picture, display_name, bio, spiritual_integration, preferred_language, timezone, focus_areas, email_notifications, sms_notifications, created_at',
      [full_name, phone, dob, profile_picture, display_name, bio, spiritual_integration, preferred_language, timezone, JSON.stringify(focus_areas), email_notifications, sms_notifications, userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Profile not found' });
    return res.json({ user: rows[0] });
  } catch (err) {
    console.error('PUT /profile error', err);
    return res.status(500).json({ error: err.message });
  }
});


// Signup route
router.post('/signup', async (req, res) => {
  try {
    const { email, password, full_name } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'email & password required' });
    }

    // Check if user exists
    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length) {
      return res.status(409).json({ error: 'Email already registered' });
    }


      // Hash password with Argon2
      const hashed = await argon2.hash(password);

    // Create user
    const q = `INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id, email, full_name`;
    const { rows } = await pool.query(q, [email, hashed, full_name || null]);
    const user = rows[0];

    // Send email notification to admin
    try {
      await sendClientSignupNotification({
        email: user.email,
        fullName: user.full_name,
        userId: user.id,
      });
    } catch (emailError) {
      console.error('Failed to send client signup notification:', emailError);
      // Continue even if email fails
    }

    // Generate JWT
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: '7d',
    });

    return res.json({ user, token });
  } catch (err) {
    console.error('AUTH signup error', err);
    return res.status(500).json({ error: err.message });
  }
});

// Dev-only: create a test user and return a JWT (only allowed in non-production)
router.post('/dev/create-test-user', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') return res.status(403).json({ error: 'Not allowed in production' });

    const { email, password, full_name } = req.body || {};
    const devEmail = email || `dev+${Date.now()}@example.com`;
    const devPassword = password || 'password123';

    // Reuse signup logic: hash and insert
    const hashed = await argon2.hash(devPassword);
    const q = `INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id, email, full_name`;
    const { rows } = await pool.query(q, [devEmail, hashed, full_name || 'Dev User']);
    const user = rows[0];

    // Generate JWT
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    return res.json({ user, token, password: devPassword });
  } catch (err) {
    console.error('DEV create-test-user error', err);
    return res.status(500).json({ error: err.message });
  }
});

// Save questionnaire responses
router.post('/questionnaire', async (req, res) => {
  try {
    const { userId, concerns, gender, notes } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    // Get user info
    const userResult = await pool.query(
      'SELECT id, email, full_name FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Save questionnaire to database (you can create a table for this)
    // For now, we'll just send the email notification

    // Send email notification with all client info + questionnaire
    try {
      await sendClientSignupNotification({
        email: user.email,
        fullName: user.full_name,
        userId: user.id,
        concerns: concerns || [],
        genderPreference: gender || 'No Preference',
        additionalNotes: notes || 'None',
      });
    } catch (emailError) {
      console.error('Failed to send questionnaire notification:', emailError);
    }

    return res.json({ success: true, message: 'Questionnaire submitted successfully' });
  } catch (err) {
    console.error('Questionnaire error', err);
    return res.status(500).json({ error: err.message });
  }
});

// Login route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'email & password required' });
    }

    // Find user
    const { rows } = await pool.query(
      'SELECT id, email, password_hash, full_name FROM users WHERE email = $1',
      [email]
    );
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }


    // Check password with Argon2
    const ok = await argon2.verify(user.password_hash, password);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: '7d',
    });

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
      },
      token,
    });
  } catch (err) {
    console.error('AUTH login error', err);
    return res.status(500).json({ error: err.message });
  }
});

// Request password reset (generates a token and stores it; in production this should be emailed)
router.post('/request-password-reset', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    // ensure password_resets table exists
    await pool.query(`CREATE TABLE IF NOT EXISTS password_resets (
      email VARCHAR(255) PRIMARY KEY,
      token VARCHAR(255) NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL
    )`);

    const r = await pool.query('SELECT id, email FROM users WHERE email = $1', [email]);
    if (!r.rows.length) return res.status(404).json({ error: 'No user with that email' });

    const token = crypto.randomBytes(20).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await pool.query(
      `INSERT INTO password_resets (email, token, expires_at) VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET token = $2, expires_at = $3`,
      [email, token, expires]
    );

    // NOTE: we return the token in the response for now so it can be used without email delivery.
    return res.json({ message: 'Password reset token generated', token });
  } catch (err) {
    console.error('request-password-reset error', err);
    return res.status(500).json({ error: err.message });
  }
});

// Reset password using token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'token and newPassword required' });

    const r = await pool.query('SELECT email, expires_at FROM password_resets WHERE token = $1', [token]);
    if (!r.rows.length) return res.status(400).json({ error: 'Invalid token' });

    const row = r.rows[0];
    if (new Date(row.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Token expired' });
    }

    const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2', [hashed, row.email]);
    await pool.query('DELETE FROM password_resets WHERE token = $1', [token]);

    return res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('reset-password error', err);
    return res.status(500).json({ error: err.message });
  }
});

// Therapist application route
router.post('/therapist/apply', async (req, res) => {
  try {
    const { fullName, email, phone, licenseNumber, experience, specialties, sessionTypes, rate60min, availability, password } = req.body;

    // Validation
    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'Email, password, and full name are required' });
    }

    // Check if therapist already exists
    const exists = await pool.query('SELECT id FROM therapists WHERE email = $1', [email]);
    if (exists.rows.length) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);

    // Create therapist application (status defaults to 'pending' in database)
    const q = `INSERT INTO therapists (email, password_hash, full_name, phone, license_number, experience_years, specialties, session_types, rate_60min, availability) 
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id, email, full_name`;
    const { rows } = await pool.query(q, [email, hashed, fullName, phone, licenseNumber, parseInt(experience), specialties, sessionTypes, parseInt(rate60min), availability]);
    const therapist = rows[0];

    // Send email notification to admin (non-blocking)
    sendTherapistApplicationNotification({
      fullName,
      email,
      phone,
      licenseNumber,
      experience,
      specialties,
      sessionTypes,
      rate60min,
      availability,
    }).catch(err => console.error('Email notification failed:', err));

    return res.json({ therapist, message: 'Application submitted successfully. You will be notified once approved.' });
  } catch (err) {
    console.error('THERAPIST apply error', err);
    return res.status(500).json({ error: err.message });
  }
});

// Therapist login route
router.post('/therapist/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Find therapist
    const { rows } = await pool.query(
      'SELECT id, email, password_hash, full_name, status FROM therapists WHERE email = $1',
      [email]
    );
    const therapist = rows[0];

    if (!therapist) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (therapist.status !== 'approved') {
      return res.status(403).json({ error: 'Your application is still under review. Please check back later.' });
    }

    // Check password
    const ok = await bcrypt.compare(password, therapist.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign({ id: therapist.id, email: therapist.email, role: 'therapist' }, JWT_SECRET, {
      expiresIn: '7d',
    });

    return res.json({
      therapist: {
        id: therapist.id,
        email: therapist.email,
        full_name: therapist.full_name,
      },
      token,
    });
  } catch (err) {
    console.error('THERAPIST login error', err);
    return res.status(500).json({ error: err.message });
  }
});

// --- Reflection routes ---
// Save reflection
router.post('/reflection', require('../middleware/auth').authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { reflection_text } = req.body;
    
    if (!reflection_text || !reflection_text.trim()) {
      return res.status(400).json({ error: 'Reflection text cannot be empty' });
    }

    const { rows } = await pool.query(
      'INSERT INTO reflections (user_id, reflection_text) VALUES ($1, $2) RETURNING id, user_id, reflection_text, created_at',
      [userId, reflection_text]
    );
    
    return res.json({ reflection: rows[0], message: 'Reflection saved successfully' });
  } catch (err) {
    console.error('POST /reflection error', err);
    return res.status(500).json({ error: err.message });
  }
});

// Get reflections for current user
router.get('/reflections', require('../middleware/auth').authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { rows } = await pool.query(
      'SELECT id, user_id, reflection_text, created_at FROM reflections WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    
    return res.json({ reflections: rows });
  } catch (err) {
    console.error('GET /reflections error', err);
    return res.status(500).json({ error: err.message });
  }
});

// Delete reflection
router.delete('/reflection/:id', require('../middleware/auth').authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const reflectionId = req.params.id;
    
    const { rows } = await pool.query(
      'DELETE FROM reflections WHERE id = $1 AND user_id = $2 RETURNING id',
      [reflectionId, userId]
    );
    
    if (!rows.length) {
      return res.status(404).json({ error: 'Reflection not found' });
    }
    
    return res.json({ message: 'Reflection deleted successfully' });
  } catch (err) {
    console.error('DELETE /reflection error', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
