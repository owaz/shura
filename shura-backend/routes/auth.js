const express = require('express');
const argon2 = require('argon2');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db'); // Properly import the pool
const { sendTherapistApplicationNotification, sendClientSignupNotification } = require('../utils/emailService');
const { autoAssignTherapist } = require('../utils/matchingService');
const { authenticateToken } = require('../middleware/auth');
const { CSRF_COOKIE, REFRESH_COOKIE, clearAuthCookies, createSession, parseCookies, revokeSession, rotateSession } = require('../utils/sessionAuth');
const router = express.Router();

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be configured in production');
  }
  return secret || 'shura_dev_jwt_secret_change_me';
};
const SALT_ROUNDS = 10;

const crypto = require('crypto');


const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 8;

const normalizeEmail = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');
const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const resetResponse = () => ({ message: 'If that email is registered, password reset instructions will be sent.' });

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean);
  return [];
};

const therapistToPublic = (therapist) => {
  const specialties = toArray(therapist.specialties);
  const sessionTypes = toArray(therapist.session_types).map((type) => {
    const normalized = String(type).toLowerCase();
    if (normalized === 'video') return 'Video';
    if (normalized === 'audio') return 'Audio';
    if (normalized === 'text') return 'Text';
    return type;
  });
  const concerns = specialties.length ? specialties : ['Faith-Centered Support'];
  const rate = Number(therapist.rate_60min || 0);

  return {
    id: therapist.id,
    name: therapist.full_name,
    title: therapist.specialization || 'Licensed Therapist',
    experience: therapist.experience_years || therapist.years_experience || 0,
    imageUrl: therapist.profile_image_url || 'https://picsum.photos/id/1005/400/400',
    bioSnippet: therapist.bio || `Supports clients with ${concerns.slice(0, 3).join(', ')} through faith-centered care.`,
    fullBio: therapist.bio || `Dr. ${therapist.full_name} provides compassionate, faith-centered support for clients seeking therapy.`,
    specialties,
    concerns,
    gender: therapist.gender || 'Female',
    language: Array.isArray(therapist.languages) ? therapist.languages.join(', ') : 'English',
    location: therapist.location || 'Online',
    sessionTypes: sessionTypes.length ? sessionTypes : ['Video', 'Audio', 'Text'],
    rates: {
      session60: rate || undefined,
    },
  };
};

const withDevToken = (payload, responseBody) => {
  if (process.env.NODE_ENV === 'production') return responseBody;
  return {
    ...responseBody,
    token: jwt.sign(payload, getJwtSecret(), { expiresIn: '15m' }),
  };
};

// --- Session routes ---
router.get('/session', authenticateToken, async (req, res) => {
  try {
    const csrfToken = req.user.sid
      ? (await pool.query('SELECT csrf_token FROM auth_sessions WHERE id = $1', [req.user.sid])).rows[0]?.csrf_token
      : null;

    if (req.user.role === 'therapist') {
      const { rows } = await pool.query('SELECT id, email, full_name FROM therapists WHERE id = $1', [req.user.id]);
      if (!rows.length) return res.status(404).json({ error: 'Therapist not found' });
      return res.json({ user: { ...rows[0], role: 'therapist' }, csrfToken });
    }

    const { rows } = await pool.query('SELECT id, email, full_name FROM users WHERE id = $1', [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    return res.json({ user: { ...rows[0], role: 'client' }, csrfToken });
  } catch (err) {
    console.error('GET /session error', err);
    return res.status(500).json({ error: err.message });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const session = await rotateSession(req, res);
    if (!session) return res.status(401).json({ error: 'Refresh session invalid or expired' });
    return res.json({ user: session.user, csrfToken: session.csrfToken });
  } catch (err) {
    console.error('POST /refresh error', err);
    return res.status(500).json({ error: err.message });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const cookies = parseCookies(req.headers.cookie || '');
    const csrfHeader = req.headers['x-csrf-token'];
    if (cookies[CSRF_COOKIE] && csrfHeader !== cookies[CSRF_COOKIE]) {
      return res.status(403).json({ error: 'Invalid CSRF token' });
    }

    const refreshCookie = cookies[REFRESH_COOKIE];
    const refreshSessionId = refreshCookie?.includes('.') ? refreshCookie.split('.', 1)[0] : null;

    await revokeSession(refreshSessionId);
    clearAuthCookies(res);
    return res.json({ success: true });
  } catch (err) {
    console.error('POST /logout error', err);
    clearAuthCookies(res);
    return res.status(500).json({ error: err.message });
  }
});

// --- Profile routes for clients ---
// Get current user's profile
router.get('/profile', authenticateToken, async (req, res) => {
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

router.get('/therapists', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, full_name, specialization, experience_years, years_experience, specialties,
              session_types, rate_60min, NULL::text as profile_image_url, NULL::text as bio,
              NULL::text[] as languages, status
       FROM therapists
       WHERE status = 'approved'
       ORDER BY full_name ASC`
    );

    return res.json({ therapists: rows.map(therapistToPublic) });
  } catch (err) {
    console.error('GET /therapists error', err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/therapists/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, full_name, specialization, experience_years, years_experience, specialties,
              session_types, rate_60min, NULL::text as profile_image_url, NULL::text as bio,
              NULL::text[] as languages, status
       FROM therapists
       WHERE id = $1 AND status = 'approved'`,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Therapist not found' });
    }

    return res.json({ therapist: therapistToPublic(rows[0]) });
  } catch (err) {
    console.error('GET /therapists/:id error', err);
    return res.status(500).json({ error: err.message });
  }
});

// Update current user's profile
router.put('/profile', authenticateToken, async (req, res) => {
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

    const session = await createSession(req, res, user, 'client');

    return res.json(withDevToken(
      { id: user.id, email: user.email, role: 'client', sid: session.sessionId },
      { user, csrfToken: session.csrfToken }
    ));
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
    const token = jwt.sign({ id: user.id, email: user.email, role: 'client' }, getJwtSecret(), { expiresIn: '7d' });

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

    let assignment = null;
    try {
      assignment = await autoAssignTherapist(user.id, {
        mainConcerns: Array.isArray(concerns) ? concerns.join(', ') : '',
        anxietySymptoms: Array.isArray(concerns) && concerns.includes('Anxiety') ? ['Anxiety'] : [],
        moodSymptoms: Array.isArray(concerns) && concerns.includes('Depression') ? ['Depression'] : [],
        traumaHistory: Array.isArray(concerns) && concerns.includes('Trauma') ? ['Trauma'] : [],
        suicidalThoughts: false,
        concernSeverity: 'moderate',
      });
    } catch (assignError) {
      console.error('Questionnaire auto-assignment failed:', assignError);
    }

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

    return res.json({
      success: true,
      message: 'Questionnaire submitted successfully',
      autoAssigned: Boolean(assignment),
      therapist: assignment?.therapist
        ? {
            id: assignment.therapist.id,
            name: assignment.therapist.full_name,
            email: assignment.therapist.email,
          }
        : null,
    });
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

    const session = await createSession(req, res, user, 'client');

    return res.json(withDevToken(
      { id: user.id, email: user.email, role: 'client', sid: session.sessionId },
      {
        user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
      },
        csrfToken: session.csrfToken,
      }
    ));
  } catch (err) {
    console.error('AUTH login error', err);
    return res.status(500).json({ error: err.message });
  }
});

// Request password reset without exposing account existence or raw stored tokens.
router.post('/request-password-reset', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!email) return res.status(400).json({ error: 'Email required' });

    const { rows } = await pool.query('SELECT id, email FROM users WHERE email = $1', [email]);
    if (!rows.length) return res.json(resetResponse());

    const token = crypto.randomBytes(RESET_TOKEN_BYTES).toString('hex');
    const tokenHash = hashResetToken(token);
    const expires = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await pool.query(
      `INSERT INTO password_resets (email, token_hash, expires_at) VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET token_hash = $2, expires_at = $3`,
      [email, tokenHash, expires]
    );

    // TODO: Send the reset link by email when the mail template/provider is available.
    return res.json({
      ...resetResponse(),
      ...(process.env.NODE_ENV === 'production' ? {} : { token })
    });
  } catch (err) {
    console.error('request-password-reset error', err);
    return res.status(500).json({ error: 'Unable to request password reset' });
  }
});

// Reset password using token
router.post('/reset-password', async (req, res) => {
  const client = await pool.connect();
  try {
    const { token, newPassword } = req.body || {};
    if (!token || !newPassword) return res.status(400).json({ error: 'token and newPassword required' });
    if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }

    const tokenHash = hashResetToken(String(token));
    await client.query('BEGIN');

    const { rows } = await client.query(
      'SELECT email, expires_at FROM password_resets WHERE token_hash = $1 FOR UPDATE',
      [tokenHash]
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const row = rows[0];
    if (new Date(row.expires_at) < new Date()) {
      await client.query('DELETE FROM password_resets WHERE token_hash = $1', [tokenHash]);
      await client.query('COMMIT');
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const hashed = await argon2.hash(newPassword);
    await client.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2', [hashed, row.email]);
    await client.query('DELETE FROM password_resets WHERE email = $1', [row.email]);
    await client.query('UPDATE auth_sessions SET revoked_at = NOW() WHERE user_id = (SELECT id FROM users WHERE email = $1) AND role = $2 AND revoked_at IS NULL', [row.email, 'client']);
    await client.query('COMMIT');

    return res.json({ message: 'Password updated successfully' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('reset-password error', err);
    return res.status(500).json({ error: 'Unable to reset password' });
  } finally {
    client.release();
  }
});

// Therapist application route
router.post('/therapist/apply', async (req, res) => {
  try {
    const { fullName, email, phone, licenseNumber, experience, specialties, sessionTypes, rate60min, availability, password } = req.body;
    const normalizedSpecialties = toArray(specialties);
    const normalizedSessionTypes = toArray(sessionTypes);

    // Validation
    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'Email, password, and full name are required' });
    }
    if (!normalizedSpecialties.length) {
      return res.status(400).json({ error: 'Specialties are required' });
    }
    if (!normalizedSessionTypes.length) {
      return res.status(400).json({ error: 'At least one session type is required' });
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
    const { rows } = await pool.query(q, [email, hashed, fullName, phone, licenseNumber, parseInt(experience), normalizedSpecialties, normalizedSessionTypes, parseInt(rate60min), availability]);
    const therapist = rows[0];

    // Send email notification to admin (non-blocking)
    sendTherapistApplicationNotification({
      fullName,
      email,
      phone,
      licenseNumber,
      experience,
      specialties: normalizedSpecialties,
      sessionTypes: normalizedSessionTypes,
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

    const session = await createSession(req, res, therapist, 'therapist');

    return res.json(withDevToken(
      { id: therapist.id, email: therapist.email, role: 'therapist', sid: session.sessionId },
      {
        therapist: {
        id: therapist.id,
        email: therapist.email,
        full_name: therapist.full_name,
      },
        csrfToken: session.csrfToken,
      }
    ));
  } catch (err) {
    console.error('THERAPIST login error', err);
    return res.status(500).json({ error: err.message });
  }
});

// --- Reflection routes ---
// Save reflection
router.post('/reflection', authenticateToken, async (req, res) => {
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
router.get('/reflections', authenticateToken, async (req, res) => {
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
router.delete('/reflection/:id', authenticateToken, async (req, res) => {
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
