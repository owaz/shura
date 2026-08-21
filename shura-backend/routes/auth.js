const express = require('express');
const argon2 = require('argon2');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db'); // Properly import the pool
const {
  sendQuestionnaireAdminNotification,
  sendTherapistApplicationNotification,
} = require('../utils/emailService');
const { autoAssignTherapist } = require('../utils/matchingService');
const { authenticateToken } = require('../middleware/auth');
const { requireClient } = require('../middleware/requireClient');
const { deleteImage, getCanonicalImageUrl, getImageReadUrl } = require('../services/azureBlobStorage');
const { CSRF_COOKIE, REFRESH_COOKIE, clearAuthCookies, createSession, parseCookies, revokeSession, rotateSession } = require('../utils/sessionAuth');
const { isPlaceholderFullName, normalizeSignupFullName } = require('../utils/signupProfile');
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

const normalizeTextList = (value) => [...new Set(toArray(value).map((item) => String(item).trim()).filter(Boolean))];

const normalizeSessionTypes = (value) => {
  const allowed = new Set(['video', 'audio', 'text']);
  return [...new Set(
    toArray(value)
      .map((item) => String(item).trim().toLowerCase())
      .filter((item) => allowed.has(item))
  )];
};

const toNullableInt = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.floor(parsed);
};

const getTherapistsColumnTypeMap = async (columnNames) => {
  const { rows } = await pool.query(
    `SELECT column_name, data_type, udt_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'therapists'
       AND column_name = ANY($1::text[])`,
    [columnNames]
  );

  return Object.fromEntries(rows.map((row) => [row.column_name, row]));
};

const isArrayColumn = (columnTypeMap, columnName) => {
  const meta = columnTypeMap[columnName];
  return Boolean(meta && (meta.data_type === 'ARRAY' || meta.udt_name === '_text'));
};

const toDbTextList = (value, columnTypeMap, columnName) => {
  const normalized = normalizeTextList(value);
  if (!normalized.length) return null;
  return isArrayColumn(columnTypeMap, columnName) ? normalized : normalized.join(', ');
};

const resolveTherapistImage = async (therapist) => {
  if (therapist.profile_image_storage_provider === 'azure_blob' && therapist.profile_image_blob_name) {
    return getImageReadUrl(therapist.profile_image_blob_name);
  }
  return therapist.profile_image_url || 'https://picsum.photos/id/1005/400/400';
};

const therapistToPublic = async (therapist) => {
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
  const languages = toArray(therapist.languages);

  return {
    id: therapist.id,
    name: therapist.full_name,
    title: therapist.specialization || 'Licensed Therapist',
    experience: therapist.experience_years || therapist.years_experience || 0,
    imageUrl: await resolveTherapistImage(therapist),
    bioSnippet: therapist.bio || `Supports clients with ${concerns.slice(0, 3).join(', ')} through faith-centered care.`,
    fullBio: therapist.bio || `Dr. ${therapist.full_name} provides compassionate, faith-centered support for clients seeking therapy.`,
    specialties,
    concerns,
    gender: therapist.gender || 'Female',
    language: languages.length ? languages.join(', ') : 'English',
    location: therapist.location || 'Online',
    sessionTypes: sessionTypes.length ? sessionTypes : ['Video', 'Audio', 'Text'],
    rates: {
      session60: rate || undefined,
    },
  };
};

const therapistToEditableProfile = async (therapist) => ({
  id: therapist.id,
  email: therapist.email,
  full_name: therapist.full_name || '',
  specialization: therapist.specialization || '',
  experience_years: therapist.experience_years || therapist.years_experience || 0,
  specialties: normalizeTextList(therapist.specialties),
  session_types: normalizeSessionTypes(therapist.session_types),
  rate_60min: Number(therapist.rate_60min || 0),
  bio: therapist.bio || '',
  profile_image_url: await resolveTherapistImage(therapist),
  profile_image_blob_name: therapist.profile_image_blob_name || '',
  profile_image_storage_provider: therapist.profile_image_storage_provider || '',
  languages: normalizeTextList(therapist.languages),
  gender: therapist.gender || '',
  location: therapist.location || '',
});

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
    if (req.user.role === 'therapist') {
      const { rows } = await pool.query('SELECT id, email, full_name FROM therapists WHERE id = $1', [req.user.id]);
      if (!rows.length) return res.status(404).json({ error: 'Therapist not found' });
      return res.json({ user: { ...rows[0], role: 'therapist', status: req.user.status } });
    }

    if (req.user.role === 'admin') {
      const { rows } = await pool.query('SELECT id, email, full_name, role FROM admins WHERE id = $1', [req.user.id]);
      if (!rows.length) return res.status(404).json({ error: 'Admin not found' });
      return res.json({ user: { ...rows[0], role: 'admin', status: 'active' } });
    }

    const { rows } = await pool.query(
      `SELECT id, email, full_name, onboarding_completed_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    return res.json({
      user: {
        ...rows[0],
        onboardingCompleted: Boolean(rows[0].onboarding_completed_at),
        role: 'client',
        status: req.user.status,
      },
    });
  } catch (err) {
    console.error('GET session error', { code: err?.code || 'SESSION_FAILED' });
    return res.status(500).json({
      error: {
        code: 'SESSION_LOOKUP_FAILED',
        message: 'We could not load your session right now.',
        details: null,
      },
    });
  }
});

router.post('/signup-profile', authenticateToken, async (req, res) => {
  if (req.user.role !== 'client') {
    return res.status(403).json({
      error: {
        code: 'CLIENT_ROLE_REQUIRED',
        message: 'Client access is required.',
        details: null,
      },
    });
  }

  const fullName = normalizeSignupFullName(req.body?.fullName);
  if (!fullName) {
    return res.status(400).json({
      error: {
        code: 'INVALID_SIGNUP_NAME',
        message: 'Enter a full name between 2 and 200 characters.',
        details: null,
      },
    });
  }

  try {
    const currentResult = await pool.query(
      'SELECT id, email, full_name FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!currentResult.rows.length) {
      return res.status(404).json({
        error: {
          code: 'CLIENT_NOT_FOUND',
          message: 'Your client profile could not be found.',
          details: null,
        },
      });
    }

    const current = currentResult.rows[0];
    if (!isPlaceholderFullName(current.full_name, current.email)) {
      return res.json({ data: { applied: false, fullName: current.full_name } });
    }

    const updated = await pool.query(
      `UPDATE users
       SET full_name = $1, updated_at = NOW()
       WHERE id = $2 AND full_name IS NOT DISTINCT FROM $3
       RETURNING full_name`,
      [fullName, req.user.id, current.full_name]
    );
    if (updated.rows.length) {
      return res.json({ data: { applied: true, fullName: updated.rows[0].full_name } });
    }

    const latest = await pool.query('SELECT full_name FROM users WHERE id = $1', [req.user.id]);
    return res.json({ data: { applied: false, fullName: latest.rows[0]?.full_name || '' } });
  } catch (err) {
    console.error('POST signup profile error', { code: err?.code || 'SIGNUP_PROFILE_FAILED' });
    return res.status(500).json({
      error: {
        code: 'SIGNUP_PROFILE_UPDATE_FAILED',
        message: 'We could not save your signup name.',
        details: null,
      },
    });
  }
});

router.post('/refresh', async (req, res) => {
  return res.status(410).json({
    error: 'Refresh tokens are managed by Auth0. Re-authenticate through Universal Login.',
  });
});

router.post('/logout', async (req, res) => {
  return res.json({ success: true, message: 'Client should clear local app state and perform Auth0 logout redirect.' });
});

// --- Profile routes for clients ---
// Get current user's profile
router.get('/profile', requireClient, async (req, res) => {
  try {
    const userId = req.user.id;
    const { rows } = await pool.query('SELECT id, email, full_name, phone, dob, profile_picture, profile_picture_blob_name, profile_picture_storage_provider, display_name, bio, spiritual_integration, preferred_language, timezone, focus_areas, email_notifications, sms_notifications, created_at FROM users WHERE id = $1', [userId]);
    if (!rows.length) return res.status(404).json({ error: 'Profile not found' });
    const user = rows[0];
    if (user.profile_picture_storage_provider === 'azure_blob' && user.profile_picture_blob_name) {
      user.profile_picture = await getImageReadUrl(user.profile_picture_blob_name);
    }
    return res.json({ user });
  } catch (err) {
    console.error('GET profile error', { code: err?.code || 'PROFILE_FAILED' });
    return res.status(500).json({ error: 'Unable to load the profile.' });
  }
});

router.get('/therapists', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, full_name, specialization, experience_years, years_experience, specialties,
              session_types, rate_60min, profile_image_url, profile_image_blob_name,
              profile_image_storage_provider, bio,
              languages, gender, location, status
       FROM therapists
       WHERE LOWER(COALESCE(status, '')) = 'approved'
       ORDER BY full_name ASC`
    );

    return res.json({ therapists: await Promise.all(rows.map(therapistToPublic)) });
  } catch (err) {
    console.error('GET therapists error', { code: err?.code || 'THERAPISTS_FAILED' });
    return res.status(500).json({ error: 'Unable to load therapists.' });
  }
});

router.get('/therapists/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, full_name, specialization, experience_years, years_experience, specialties,
              session_types, rate_60min, profile_image_url, profile_image_blob_name,
              profile_image_storage_provider, bio,
              languages, gender, location, status
       FROM therapists
       WHERE id = $1 AND LOWER(COALESCE(status, '')) = 'approved'`,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Therapist not found' });
    }

    return res.json({ therapist: await therapistToPublic(rows[0]) });
  } catch (err) {
    console.error('GET therapist error', { code: err?.code || 'THERAPIST_FAILED' });
    return res.status(500).json({ error: 'Unable to load this therapist.' });
  }
});

router.get('/therapist/profile', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'therapist') {
      return res.status(403).json({ error: 'Therapist access required' });
    }

    const { rows } = await pool.query(
      `SELECT id, email, full_name, specialization, experience_years, years_experience,
              specialties, session_types, rate_60min, bio, profile_image_url,
              profile_image_blob_name, profile_image_storage_provider,
              languages, gender, location, status
       FROM therapists
       WHERE id = $1`,
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Therapist profile not found' });
    }

    return res.json({
      profile: await therapistToEditableProfile(rows[0]),
      therapist: await therapistToPublic(rows[0]),
    });
  } catch (err) {
    console.error('GET therapist profile error', { code: err?.code || 'THERAPIST_PROFILE_FAILED' });
    return res.status(500).json({ error: 'Unable to load the therapist profile.' });
  }
});

router.put('/therapist/profile', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'therapist') {
      return res.status(403).json({ error: 'Therapist access required' });
    }

    const payload = req.body || {};
    const fullName = typeof payload.full_name === 'string' ? payload.full_name.trim() : '';
    const specialization = typeof payload.specialization === 'string' ? payload.specialization.trim() : '';
    const bio = typeof payload.bio === 'string' ? payload.bio.trim() : '';
    const profileImageBlobName = typeof payload.profile_image_blob_name === 'string' ? payload.profile_image_blob_name.trim() : '';
    const gender = typeof payload.gender === 'string' ? payload.gender.trim() : '';
    const location = typeof payload.location === 'string' ? payload.location.trim() : '';
    const experienceYears = toNullableInt(payload.experience_years);
    const rate60min = toNullableInt(payload.rate_60min);

    if (!fullName) {
      return res.status(400).json({ error: 'full_name is required' });
    }

    const columnTypeMap = await getTherapistsColumnTypeMap(['specialties', 'session_types', 'languages']);
    const dbSpecialties = toDbTextList(payload.specialties, columnTypeMap, 'specialties');
    const normalizedSessionTypes = normalizeSessionTypes(payload.session_types);
    const dbSessionTypes = normalizedSessionTypes.length
      ? (isArrayColumn(columnTypeMap, 'session_types') ? normalizedSessionTypes : normalizedSessionTypes.join(', '))
      : null;
    const dbLanguages = toDbTextList(payload.languages, columnTypeMap, 'languages');

    const expectedBlobPrefix = `uploads/therapist/${req.user.id}/`;
    if (profileImageBlobName && !profileImageBlobName.startsWith(expectedBlobPrefix)) {
      return res.status(400).json({ error: 'Invalid therapist profile image.' });
    }
    const existingImage = await pool.query(
      `SELECT profile_image_url, profile_image_blob_name, profile_image_storage_provider
       FROM therapists WHERE id = $1`,
      [req.user.id]
    );
    const nextBlobName = profileImageBlobName || existingImage.rows[0]?.profile_image_blob_name || null;
    const nextImageProvider = nextBlobName ? 'azure_blob' : existingImage.rows[0]?.profile_image_storage_provider || null;
    const nextImageUrl = nextImageProvider === 'azure_blob'
      ? getCanonicalImageUrl(nextBlobName)
      : existingImage.rows[0]?.profile_image_url || null;

    const { rows } = await pool.query(
      `UPDATE therapists
       SET full_name = $1,
           specialization = $2,
           experience_years = $3,
           specialties = $4,
           session_types = $5,
           rate_60min = $6,
           bio = $7,
           profile_image_url = $8,
           profile_image_blob_name = $9,
           profile_image_storage_provider = $10,
           languages = $11,
           gender = $12,
           location = $13,
           updated_at = NOW()
       WHERE id = $14
       RETURNING id, email, full_name, specialization, experience_years, years_experience,
                 specialties, session_types, rate_60min, bio, profile_image_url,
                 profile_image_blob_name, profile_image_storage_provider,
                 languages, gender, location, status`,
      [
        fullName,
        specialization || null,
        experienceYears,
        dbSpecialties,
        dbSessionTypes,
        rate60min,
        bio || null,
        nextImageUrl,
        nextBlobName,
        nextImageProvider,
        dbLanguages,
        gender || null,
        location || null,
        req.user.id,
      ]
    );

    const previousBlobName = existingImage.rows[0]?.profile_image_blob_name;
    if (existingImage.rows[0]?.profile_image_storage_provider === 'azure_blob' && previousBlobName && previousBlobName !== nextBlobName) {
      deleteImage(previousBlobName).catch((err) => console.error('Could not remove replaced therapist image', { code: err?.code || 'IMAGE_DELETE_FAILED' }));
    }

    if (!rows.length) {
      return res.status(404).json({ error: 'Therapist profile not found' });
    }

    return res.json({
      message: 'Therapist profile updated successfully',
      profile: await therapistToEditableProfile(rows[0]),
      therapist: await therapistToPublic(rows[0]),
    });
  } catch (err) {
    console.error('PUT therapist profile error', { code: err?.code || 'THERAPIST_PROFILE_UPDATE_FAILED' });
    return res.status(500).json({ error: 'Unable to update the therapist profile.' });
  }
});

// Update current user's profile
router.put('/profile', requireClient, async (req, res) => {
  try {
    const userId = req.user.id;
    const { full_name, phone, dob, display_name, bio, spiritual_integration, preferred_language, timezone, focus_areas, email_notifications, sms_notifications } = req.body;
    const { rows } = await pool.query(
      'UPDATE users SET full_name = $1, phone = $2, dob = $3, display_name = $4, bio = $5, spiritual_integration = $6, preferred_language = $7, timezone = $8, focus_areas = $9, email_notifications = $10, sms_notifications = $11, updated_at = NOW() WHERE id = $12 RETURNING id, email, full_name, phone, dob, profile_picture, profile_picture_blob_name, profile_picture_storage_provider, display_name, bio, spiritual_integration, preferred_language, timezone, focus_areas, email_notifications, sms_notifications, created_at',
      [full_name, phone, dob, display_name, bio, spiritual_integration, preferred_language, timezone, JSON.stringify(focus_areas), email_notifications, sms_notifications, userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Profile not found' });
    const user = rows[0];
    if (user.profile_picture_storage_provider === 'azure_blob' && user.profile_picture_blob_name) {
      user.profile_picture = await getImageReadUrl(user.profile_picture_blob_name);
    }
    return res.json({ user });
  } catch (err) {
    console.error('PUT profile error', { code: err?.code || 'PROFILE_UPDATE_FAILED' });
    return res.status(500).json({ error: 'Unable to update the profile.' });
  }
});


// Signup route
router.post('/signup', async (req, res) => {
  return res.status(410).json({
    error: 'Direct signup has been removed. Use Auth0 Universal Login signup.',
  });
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
    console.error('DEV create-test-user error', { code: err?.code || 'DEV_USER_FAILED' });
    return res.status(500).json({ error: 'Unable to create the development user.' });
  }
});

// Save questionnaire responses
router.post('/questionnaire', requireClient, async (req, res) => {
  try {
    if (req.user.role !== 'client') {
      return res.status(403).json({ error: 'Client access required' });
    }
    const { concerns, gender, notes } = req.body;
    const userId = req.user.id;

    // Get user info
    const userResult = await pool.query(
      'SELECT id, email, full_name FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    const emailResult = await sendQuestionnaireAdminNotification({ userId: user.id });
    if (!emailResult.success) {
      throw new Error(emailResult.error || 'Questionnaire notification could not be queued');
    }

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
    console.error('Questionnaire error', { code: err?.code || 'QUESTIONNAIRE_SUBMISSION_FAILED' });
    return res.status(500).json({ error: 'Unable to submit the questionnaire.' });
  }
});

// Login route
router.post('/login', async (req, res) => {
  try {
    return res.status(410).json({
      error: 'Direct login has been removed. Use Auth0 Universal Login.',
    });

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
    console.error('AUTH login error', { code: err?.code || 'LOGIN_FAILED' });
    return res.status(500).json({ error: 'Unable to sign in.' });
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
    console.error('Password reset request error', { code: err?.code || 'PASSWORD_RESET_REQUEST_FAILED' });
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
    console.error('Password reset error', { code: err?.code || 'PASSWORD_RESET_FAILED' });
    return res.status(500).json({ error: 'Unable to reset password' });
  } finally {
    client.release();
  }
});

// Therapist application route
router.post('/therapist/apply', async (req, res) => {
  return res.status(410).json({
    error: 'Legacy therapist signup has been removed. Use Auth0 Universal Login signup.',
  });
});

// Auth0 flow: therapist identity is created in Auth0 first, then professional profile is completed here.
router.post('/therapist/application', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'therapist') {
      return res.status(403).json({ error: 'Therapist access required' });
    }

    const {
      fullName,
      phone,
      licenseNumber,
      experience,
      specialties,
      sessionTypes,
      rate60min,
      availability,
      languages,
      gender,
      location,
      bio,
    } = req.body || {};

    const normalizedSpecialties = normalizeTextList(specialties);
    const normalizedSessionTypes = normalizeSessionTypes(sessionTypes);
    const normalizedAvailability = normalizeTextList(availability);
    const normalizedLanguages = normalizeTextList(languages);

    if (!String(fullName || '').trim()) {
      return res.status(400).json({ error: 'fullName is required' });
    }
    if (!normalizedSpecialties.length) {
      return res.status(400).json({ error: 'specialties are required' });
    }
    if (!normalizedSessionTypes.length) {
      return res.status(400).json({ error: 'At least one session type is required' });
    }
    if (!normalizedAvailability.length) {
      return res.status(400).json({ error: 'availability is required' });
    }

    const columnTypeMap = await getTherapistsColumnTypeMap(['specialties', 'session_types', 'availability', 'languages']);
    const dbSpecialties = toDbTextList(normalizedSpecialties, columnTypeMap, 'specialties');
    const dbSessionTypes = isArrayColumn(columnTypeMap, 'session_types')
      ? normalizedSessionTypes
      : normalizedSessionTypes.join(', ');
    const dbAvailability = toDbTextList(normalizedAvailability, columnTypeMap, 'availability');
    const dbLanguages = toDbTextList(normalizedLanguages, columnTypeMap, 'languages');

    const client = await pool.connect();
    let rows;
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE therapists
       SET full_name = $1,
           phone = $2,
           license_number = $3,
           experience_years = $4,
           specialties = $5,
           session_types = $6,
           rate_60min = $7,
           availability = $8,
           languages = $9,
           gender = $10,
           location = $11,
           bio = $12,
           status = COALESCE(NULLIF(status, ''), 'pending'),
           updated_at = NOW()
       WHERE id = $13
         RETURNING id, auth0_sub, email, full_name, status, specialties, session_types, availability, rate_60min`,
        [
          String(fullName).trim(),
          typeof phone === 'string' ? phone.trim() || null : null,
          typeof licenseNumber === 'string' ? licenseNumber.trim() || null : null,
          toNullableInt(experience),
          dbSpecialties,
          dbSessionTypes,
          toNullableInt(rate60min),
          dbAvailability,
          dbLanguages,
          typeof gender === 'string' ? gender.trim() || null : null,
          typeof location === 'string' ? location.trim() || null : null,
          typeof bio === 'string' ? bio.trim() || null : null,
          req.user.id,
        ]
      );
      rows = result.rows;
      if (!rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Therapist profile not found' });
      }
      const notification = await sendTherapistApplicationNotification({
        applicationId: rows[0].id,
      }, client);
      if (!notification.success) throw new Error(notification.error);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }

    return res.json({
      message: 'Therapist application submitted successfully. Your profile is now under review.',
      therapist: rows[0],
    });
  } catch (err) {
    console.error('Therapist application error', { code: err?.code || 'THERAPIST_APPLICATION_FAILED' });
    return res.status(500).json({ error: 'Unable to submit the therapist application.' });
  }
});

// Therapist login route
router.post('/therapist/login', async (req, res) => {
  try {
    return res.status(410).json({
      error: 'Therapist password login has been removed. Use Auth0 Universal Login.',
    });

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
    console.error('THERAPIST login error', { code: err?.code || 'THERAPIST_LOGIN_FAILED' });
    return res.status(500).json({ error: 'Unable to sign in.' });
  }
});

// --- Reflection routes ---
// Save reflection
router.post('/reflection', requireClient, async (req, res) => {
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
    console.error('POST reflection error', { code: err?.code || 'REFLECTION_CREATE_FAILED' });
    return res.status(500).json({ error: 'Unable to save the reflection.' });
  }
});

// Get reflections for current user
router.get('/reflections', requireClient, async (req, res) => {
  try {
    const userId = req.user.id;
    const { rows } = await pool.query(
      'SELECT id, user_id, reflection_text, created_at FROM reflections WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    
    return res.json({ reflections: rows });
  } catch (err) {
    console.error('GET reflections error', { code: err?.code || 'REFLECTIONS_FAILED' });
    return res.status(500).json({ error: 'Unable to load reflections.' });
  }
});

// Delete reflection
router.delete('/reflection/:id', requireClient, async (req, res) => {
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
    console.error('DELETE reflection error', { code: err?.code || 'REFLECTION_DELETE_FAILED' });
    return res.status(500).json({ error: 'Unable to delete the reflection.' });
  }
});

module.exports = router;
