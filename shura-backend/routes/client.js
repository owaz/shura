const express = require('express');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const pool = require('../db');
const { requireClient } = require('../middleware/requireClient');
const { csrfProtection } = require('../middleware/csrf');
const { errorResponse } = require('../utils/apiResponse');
const {
  profileColumnMap,
  preferenceDefinitions,
  validatePreferencePatch,
  validateProfilePatch,
} = require('../utils/clientPortalValidation');
const {
  createPasswordChangeTicket,
  deleteUser: deleteAuth0User,
  setBlocked,
} = require('../services/auth0Management');
const { deleteImage, getImageReadUrl, uploadImage } = require('../services/azureBlobStorage');
const { sanitizeImageMetadata } = require('../utils/imageSanitization');
const { toAssignedTherapist } = require('../utils/clientTherapist');
const { sendTherapistReleaseNotification } = require('../utils/emailService');
const clientSessionsRouter = require('./clientSessions');
const clientBookingsRouter = require('./clientBookings');
const clientDashboardRouter = require('./clientDashboard');
const clientBillingRouter = require('./clientBilling');

const router = express.Router();
router.use(requireClient);
router.use(csrfProtection);
router.use('/sessions', clientSessionsRouter);
router.use(clientBookingsRouter);
router.use(clientDashboardRouter);
router.use(clientBillingRouter);

const mutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 80,
  standardHeaders: true,
  legacyHeaders: false,
});
const sensitiveLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
});

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    callback(null, ['image/jpeg', 'image/png'].includes(file.mimetype));
  },
});

const uploadOnePhoto = (req, res, next) => imageUpload.single('image')(req, res, (err) => {
  if (!err) return next();
  const message = err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
    ? 'Your photo must be 5 MB or smaller.'
    : 'Choose a JPG or PNG image up to 5 MB.';
  return errorResponse(res, 400, 'INVALID_PROFILE_PHOTO', message);
});

const hasValidImageSignature = (file) => {
  if (!file?.buffer) return false;
  const bytes = file.buffer;
  if (file.mimetype === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (file.mimetype === 'image/png') {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
  }
  return false;
};

const resolveProfilePicture = async (row) => {
  if (row.profile_picture_storage_provider === 'azure_blob' && row.profile_picture_blob_name) {
    return getImageReadUrl(row.profile_picture_blob_name);
  }
  return row.profile_picture || '';
};

const toProfile = async (row) => ({
  id: row.id,
  email: row.email,
  firstName: row.first_name || '',
  lastName: row.last_name || '',
  fullName: row.full_name || '',
  dateOfBirth: row.date_of_birth ? String(row.date_of_birth).slice(0, 10) : '',
  gender: row.gender || '',
  phone: row.phone || '',
  country: row.country || '',
  city: row.city || '',
  timezone: row.timezone || '',
  aboutMe: row.about_me || '',
  emergencyContactName: row.emergency_contact_name || '',
  emergencyContactRelationship: row.emergency_contact_relationship || '',
  emergencyContactPhone: row.emergency_contact_phone || '',
  profilePicture: await resolveProfilePicture(row),
  onboardingCompleted: Boolean(row.onboarding_completed_at),
  memberSince: row.created_at,
});

const toPreferences = (row = {}) => ({
  therapistGenderPreference: row.therapist_gender_preference || 'no_preference',
  languages: row.languages || [],
  islamicApproach: row.islamic_approach || 'no_preference',
  specialisationInterests: row.specialisation_interests || [],
  sessionTypePreference: row.session_type_preference || 'no_preference',
  sessionDurationPreference: row.session_duration_preference || 'no_preference',
  preferredDays: row.preferred_days || [],
  preferredTimeOfDay: row.preferred_time_of_day || 'no_preference',
  notificationEmailReminder24h: row.notification_email_reminder_24h ?? true,
  notificationEmailReminder1h: row.notification_email_reminder_1h ?? true,
  notificationSmsReminder1h: row.notification_sms_reminder_1h ?? false,
  notificationBookingConfirmation: row.notification_booking_confirmation ?? true,
  notificationCancellation: row.notification_cancellation ?? true,
  notificationPlatformUpdates: row.notification_platform_updates ?? true,
  privacyShareAboutMe: row.privacy_share_about_me ?? true,
  privacyAllowAnonymisedData: row.privacy_allow_anonymised_data ?? true,
});

const ensurePreferences = async (queryable, clientId) => {
  const { rows } = await queryable.query(
    `INSERT INTO client_preferences (client_id)
     VALUES ($1)
     ON CONFLICT (client_id) DO UPDATE SET client_id = EXCLUDED.client_id
     RETURNING *`,
    [clientId]
  );
  return rows[0];
};

const updateProfile = async (queryable, clientId, values) => {
  const entries = Object.entries(values).filter(([key]) => profileColumnMap[key]);
  if (!entries.length) return null;
  const assignments = entries.map(([key], index) => `${profileColumnMap[key]} = $${index + 1}`);
  const params = entries.map(([, value]) => value);
  params.push(clientId);
  let { rows } = await queryable.query(
    `UPDATE users SET ${assignments.join(', ')}, updated_at = NOW()
     WHERE id = $${params.length}
     RETURNING *`,
    params
  );
  // PostgreSQL evaluates SET expressions from the pre-update row. Recalculate
  // the display name after first/last name changes so it never lags one save.
  if (Object.prototype.hasOwnProperty.call(values, 'firstName') || Object.prototype.hasOwnProperty.call(values, 'lastName')) {
    ({ rows } = await queryable.query(
      `UPDATE users
       SET full_name = TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))
       WHERE id = $1 RETURNING *`,
      [clientId]
    ));
  }
  return rows[0];
};

const configuredOptionErrors = async (queryable, values) => {
  if (!values.languages && !values.specialisationInterests && !values.goals) return {};
  const { rows } = await queryable.query(
    `SELECT setting_value FROM platform_settings WHERE setting_key = 'client_profile_options'`
  );
  const options = rows[0]?.setting_value || {};
  const errors = {};
  if (values.languages && values.languages.some((value) => !(options.languages || []).includes(value))) {
    errors.languages = 'Choose languages supported by Shura.';
  }
  if (values.specialisationInterests && values.specialisationInterests.some((value) => !(options.specialisations || []).includes(value))) {
    errors.specialisationInterests = 'Choose specialisation areas supported by Shura.';
  }
  if (values.goals && values.goals.some((value) => !(options.specialisations || []).includes(value))) {
    errors.goals = 'Choose goal areas supported by Shura.';
  }
  return errors;
};

const updatePreferences = async (queryable, clientId, values) => {
  await ensurePreferences(queryable, clientId);
  const entries = Object.entries(values).filter(([key]) => preferenceDefinitions[key]);
  if (!entries.length) return ensurePreferences(queryable, clientId);
  const assignments = entries.map(([key], index) => `${preferenceDefinitions[key].column} = $${index + 1}`);
  const params = entries.map(([, value]) => value);
  params.push(clientId);
  const { rows } = await queryable.query(
    `UPDATE client_preferences
     SET ${assignments.join(', ')}, updated_at = NOW()
     WHERE client_id = $${params.length}
     RETURNING *`,
    params
  );
  return rows[0];
};

const validationError = (res, errors) =>
  errorResponse(res, 400, 'VALIDATION_FAILED', 'Please review the highlighted fields.', errors);

const assignedTherapistQuery = `
  SELECT t.id, t.full_name, t.email, t.specialization, t.credentials,
         t.is_verified, t.profile_image_url, t.profile_image_blob_name,
         t.profile_image_storage_provider, t.bio, t.specialties, t.approach,
         t.faith_integration, t.languages, t.session_types,
         t.session_duration_options, tc.assigned_at,
         COALESCE((
           SELECT AVG(review.rating)::numeric(3,2)
           FROM client_session_reviews review
           WHERE review.therapist_id = t.id
         ), 0) AS average_rating,
         (
           SELECT COUNT(*)::integer
           FROM client_session_reviews review
           WHERE review.therapist_id = t.id
         ) AS review_count
  FROM therapist_clients tc
  JOIN therapists t ON t.id = tc.therapist_id
  WHERE tc.client_id = $1
    AND tc.status = 'active'
    AND LOWER(COALESCE(t.status, '')) = 'approved'
  ORDER BY tc.assigned_at DESC NULLS LAST, tc.id DESC
  LIMIT 1`;

router.get('/therapist', async (req, res) => {
  try {
    const assignment = await pool.query(assignedTherapistQuery, [req.clientId]);
    const therapist = assignment.rows[0];
    if (!therapist) return res.json({ data: { therapist: null } });

    const availability = await pool.query(
      `SELECT day_of_week, start_time, end_time, timezone
       FROM therapist_availability_rules
       WHERE therapist_id = $1 AND is_active = TRUE
       ORDER BY day_of_week ASC, start_time ASC`,
      [therapist.id]
    );
    const imageUrl = therapist.profile_image_storage_provider === 'azure_blob' && therapist.profile_image_blob_name
      ? await getImageReadUrl(therapist.profile_image_blob_name)
      : therapist.profile_image_url || '';

    return res.json({
      data: {
        therapist: toAssignedTherapist({ therapist, availability: availability.rows, imageUrl }),
      },
    });
  } catch (err) {
    console.error('GET /api/client/therapist error', err);
    return errorResponse(res, 500, 'THERAPIST_LOAD_FAILED', 'We could not load your therapist right now.');
  }
});

router.post('/therapist/release', sensitiveLimiter, async (req, res) => {
  const client = await pool.connect();
  let releasedAssignment = null;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT tc.id AS assignment_id, t.id AS therapist_id, t.email AS therapist_email,
              t.full_name AS therapist_name, u.full_name AS client_name
       FROM therapist_clients tc
       JOIN therapists t ON t.id = tc.therapist_id
       JOIN users u ON u.id = tc.client_id
       WHERE tc.client_id = $1 AND tc.status = 'active'
       ORDER BY tc.assigned_at DESC NULLS LAST, tc.id DESC
       LIMIT 1
       FOR UPDATE OF tc`,
      [req.clientId]
    );
    releasedAssignment = rows[0] || null;
    if (!releasedAssignment) {
      await client.query('COMMIT');
      return res.json({ data: { released: false, therapistId: null } });
    }

    await client.query(
      `UPDATE therapist_clients
       SET status = 'released', updated_at = NOW()
       WHERE id = $1`,
      [releasedAssignment.assignment_id]
    );
    await client.query(
      `INSERT INTO notifications (client_id, type, title, body, metadata)
       VALUES ($1, 'therapist_assignment_released', 'Therapist preference updated',
               'Your current therapist assignment has been released. You can now choose a different therapist.',
               $2::jsonb)`,
      [req.clientId, JSON.stringify({ therapistId: releasedAssignment.therapist_id })]
    );
    await client.query('COMMIT');

    const notification = await sendTherapistReleaseNotification({
      therapistEmail: releasedAssignment.therapist_email,
      therapistName: releasedAssignment.therapist_name,
      clientName: releasedAssignment.client_name,
    });
    return res.json({
      data: {
        released: true,
        therapistId: releasedAssignment.therapist_id,
        notificationSent: notification.success,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('POST /api/client/therapist/release error', err);
    return errorResponse(res, 500, 'THERAPIST_RELEASE_FAILED', 'We could not update your therapist assignment.');
  } finally {
    client.release();
  }
});

router.get('/bootstrap', async (req, res) => {
  try {
    const [clientResult, featureResult] = await Promise.all([
      pool.query(
        `SELECT id, email, full_name, first_name, last_name, profile_picture,
                profile_picture_blob_name, profile_picture_storage_provider,
                onboarding_completed_at, onboarding_current_step, timezone
         FROM users WHERE id = $1`,
        [req.clientId]
      ),
      pool.query(`SELECT setting_value FROM platform_settings WHERE setting_key = 'client_portal_features'`),
    ]);
    if (!clientResult.rows.length) {
      return errorResponse(res, 404, 'CLIENT_NOT_FOUND', 'Your client profile could not be found.');
    }
    const client = clientResult.rows[0];
    return res.json({
      data: {
        client: {
          id: client.id,
          email: client.email,
          fullName: client.full_name,
          firstName: client.first_name,
          lastName: client.last_name,
          profilePicture: await resolveProfilePicture(client),
          timezone: client.timezone,
          onboardingCurrentStep: client.onboarding_current_step,
          onboardingCompleted: Boolean(client.onboarding_completed_at),
        },
        features: featureResult.rows[0]?.setting_value || {
          billingEnabled: false,
          messagingEnabled: false,
          videoProvider: 'unconfigured',
        },
      },
    });
  } catch (err) {
    console.error('GET /api/client/bootstrap error', err);
    return errorResponse(res, 500, 'CLIENT_BOOTSTRAP_FAILED', 'We could not load your portal right now.');
  }
});

router.get('/profile', async (req, res) => {
  try {
    const [profileResult, preferences] = await Promise.all([
      pool.query('SELECT * FROM users WHERE id = $1', [req.clientId]),
      ensurePreferences(pool, req.clientId),
    ]);
    if (!profileResult.rows.length) {
      return errorResponse(res, 404, 'CLIENT_NOT_FOUND', 'Your client profile could not be found.');
    }
    return res.json({ data: { profile: await toProfile(profileResult.rows[0]), preferences: toPreferences(preferences) } });
  } catch (err) {
    console.error('GET /api/client/profile error', err);
    return errorResponse(res, 500, 'PROFILE_LOAD_FAILED', 'We could not load your profile.');
  }
});

router.patch('/profile', mutationLimiter, async (req, res) => {
  const { errors, values } = validateProfilePatch(req.body);
  if (Object.keys(errors).length) return validationError(res, errors);
  if (!Object.keys(values).length) {
    return errorResponse(res, 400, 'NO_PROFILE_CHANGES', 'Include at least one profile field to update.');
  }
  try {
    const profile = await updateProfile(pool, req.clientId, values);
    return res.json({ data: { profile: await toProfile(profile) } });
  } catch (err) {
    console.error('PATCH /api/client/profile error', err);
    return errorResponse(res, 500, 'PROFILE_UPDATE_FAILED', 'Your changes could not be saved.');
  }
});

router.patch('/preferences', mutationLimiter, async (req, res) => {
  const { errors, values } = validatePreferencePatch(req.body);
  if (Object.keys(errors).length) return validationError(res, errors);
  if (!Object.keys(values).length) {
    return errorResponse(res, 400, 'NO_PREFERENCE_CHANGES', 'Include at least one preference to update.');
  }
  try {
    const optionErrors = await configuredOptionErrors(pool, values);
    if (Object.keys(optionErrors).length) return validationError(res, optionErrors);
    if (values.notificationSmsReminder1h === true) {
      const phoneResult = await pool.query('SELECT phone FROM users WHERE id = $1', [req.clientId]);
      if (!phoneResult.rows[0]?.phone) {
        return validationError(res, { notificationSmsReminder1h: 'Add a phone number before enabling SMS reminders.' });
      }
    }
    const preferences = await updatePreferences(pool, req.clientId, values);
    return res.json({ data: { preferences: toPreferences(preferences) } });
  } catch (err) {
    console.error('PATCH /api/client/preferences error', err);
    return errorResponse(res, 500, 'PREFERENCES_UPDATE_FAILED', 'Your preference could not be saved.');
  }
});

router.get('/onboarding', async (req, res) => {
  try {
    const [profileResult, preferences, assignmentResult] = await Promise.all([
      pool.query('SELECT * FROM users WHERE id = $1', [req.clientId]),
      ensurePreferences(pool, req.clientId),
      pool.query(
        `SELECT t.id, t.full_name
         FROM therapist_clients tc
         JOIN therapists t ON t.id = tc.therapist_id
         WHERE tc.client_id = $1 AND tc.status = 'active' AND t.status = 'approved'
         ORDER BY tc.assigned_at DESC LIMIT 1`,
        [req.clientId]
      ),
    ]);
    const profileRow = profileResult.rows[0];
    if (!profileRow) return errorResponse(res, 404, 'CLIENT_NOT_FOUND', 'Your client profile could not be found.');
    return res.json({
      data: {
        currentStep: profileRow.onboarding_completed_at ? 5 : profileRow.onboarding_current_step || 1,
        completed: Boolean(profileRow.onboarding_completed_at),
        profile: await toProfile(profileRow),
        preferences: toPreferences(preferences),
        goals: profileRow.onboarding_goals || [],
        notes: profileRow.onboarding_notes || '',
        assignedTherapist: assignmentResult.rows[0]
          ? { id: assignmentResult.rows[0].id, name: assignmentResult.rows[0].full_name }
          : null,
      },
    });
  } catch (err) {
    console.error('GET /api/client/onboarding error', err);
    return errorResponse(res, 500, 'ONBOARDING_LOAD_FAILED', 'We could not load your onboarding progress.');
  }
});

router.patch('/onboarding', mutationLimiter, async (req, res) => {
  const step = Number(req.body?.step);
  if (![1, 2, 3, 4].includes(step)) {
    return validationError(res, { step: 'Choose a valid onboarding step.' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (step === 2) {
      const { errors, values } = validateProfilePatch(req.body?.profile, { requireCore: true });
      if (Object.keys(errors).length) {
        await client.query('ROLLBACK');
        return validationError(res, errors);
      }
      await updateProfile(client, req.clientId, values);
    }
    if (step === 3) {
      const { errors, values } = validatePreferencePatch(req.body?.preferences, { requireMatching: true });
      if (Object.keys(errors).length) {
        await client.query('ROLLBACK');
        return validationError(res, errors);
      }
      const optionErrors = await configuredOptionErrors(client, values);
      if (Object.keys(optionErrors).length) {
        await client.query('ROLLBACK');
        return validationError(res, optionErrors);
      }
      await updatePreferences(client, req.clientId, values);
    }
    if (step === 4) {
      const goals = req.body?.goals;
      const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() : '';
      if (!Array.isArray(goals) || goals.some((goal) => typeof goal !== 'string' || goal.trim().length > 100)) {
        await client.query('ROLLBACK');
        return validationError(res, { goals: 'Choose valid goal areas.' });
      }
      if (notes.length > 500) {
        await client.query('ROLLBACK');
        return validationError(res, { notes: 'Keep this to 500 characters or fewer.' });
      }
      const normalizedGoals = [...new Set(goals.map((goal) => goal.trim()).filter(Boolean))];
      const optionErrors = await configuredOptionErrors(client, { goals: normalizedGoals });
      if (Object.keys(optionErrors).length) {
        await client.query('ROLLBACK');
        return validationError(res, optionErrors);
      }
      await client.query(
        `UPDATE users SET onboarding_goals = $1, onboarding_notes = $2, updated_at = NOW() WHERE id = $3`,
        [normalizedGoals, notes || null, req.clientId]
      );
    }
    const nextStep = Math.min(5, step + 1);
    const { rows } = await client.query(
      `UPDATE users
       SET onboarding_current_step = GREATEST(onboarding_current_step, $1), updated_at = NOW()
       WHERE id = $2 RETURNING onboarding_current_step`,
      [nextStep, req.clientId]
    );
    await client.query('COMMIT');
    return res.json({ data: { currentStep: rows[0].onboarding_current_step } });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('PATCH /api/client/onboarding error', err);
    return errorResponse(res, 500, 'ONBOARDING_SAVE_FAILED', 'Your progress could not be saved.');
  } finally {
    client.release();
  }
});

router.post('/onboarding/complete', mutationLimiter, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.first_name, u.last_name, u.date_of_birth, u.gender, u.timezone,
              cp.therapist_gender_preference, cp.languages, cp.islamic_approach
       FROM users u
       LEFT JOIN client_preferences cp ON cp.client_id = u.id
       WHERE u.id = $1`,
      [req.clientId]
    );
    const row = rows[0];
    const missing = [];
    for (const key of ['first_name', 'last_name', 'date_of_birth', 'gender', 'timezone', 'therapist_gender_preference', 'islamic_approach']) {
      if (!row?.[key]) missing.push(key);
    }
    if (!Array.isArray(row?.languages) || !row.languages.length) missing.push('languages');
    if (missing.length) return validationError(res, { missing });

    await pool.query(
      `UPDATE users
       SET onboarding_completed_at = COALESCE(onboarding_completed_at, NOW()),
           onboarding_current_step = 5,
           updated_at = NOW()
       WHERE id = $1`,
      [req.clientId]
    );
    const assignment = await pool.query(
      `SELECT t.id, t.full_name
       FROM therapist_clients tc JOIN therapists t ON t.id = tc.therapist_id
       WHERE tc.client_id = $1 AND tc.status = 'active' AND t.status = 'approved'
       ORDER BY tc.assigned_at DESC LIMIT 1`,
      [req.clientId]
    );
    return res.json({
      data: {
        completed: true,
        assignedTherapist: assignment.rows[0]
          ? { id: assignment.rows[0].id, name: assignment.rows[0].full_name }
          : null,
      },
    });
  } catch (err) {
    console.error('POST /api/client/onboarding/complete error', err);
    return errorResponse(res, 500, 'ONBOARDING_COMPLETE_FAILED', 'We could not finish your setup.');
  }
});

router.post('/profile/photo', sensitiveLimiter, uploadOnePhoto, async (req, res) => {
  if (!req.file || !hasValidImageSignature(req.file)) {
    return errorResponse(res, 400, 'INVALID_PROFILE_PHOTO', 'Choose a genuine JPG or PNG image up to 5 MB.');
  }
  let uploaded;
  try {
    const existing = await pool.query(
      `SELECT profile_picture_blob_name, profile_picture_storage_provider
       FROM users WHERE id = $1`,
      [req.clientId]
    );
    uploaded = await uploadImage({
      buffer: sanitizeImageMetadata(req.file.buffer, req.file.mimetype),
      mimeType: req.file.mimetype,
      namespace: `client-profiles/${req.clientId}`,
      metadata: { ownerType: 'client', ownerId: req.clientId, purpose: 'profile-photo' },
    });
    await pool.query(
      `UPDATE users
       SET profile_picture = $1,
           profile_picture_blob_name = $2,
           profile_picture_storage_provider = 'azure_blob',
           profile_picture_public_id = NULL,
           updated_at = NOW()
       WHERE id = $3`,
      [uploaded.canonicalUrl, uploaded.blobName, req.clientId]
    );
    const oldBlobName = existing.rows[0]?.profile_picture_blob_name;
    if (existing.rows[0]?.profile_picture_storage_provider === 'azure_blob' && oldBlobName && oldBlobName !== uploaded.blobName) {
      deleteImage(oldBlobName).catch((err) => {
        console.error('Could not remove replaced Azure profile photo', err?.message || err);
      });
    }
    return res.json({ data: { profilePicture: uploaded.readUrl } });
  } catch (err) {
    if (uploaded?.blobName) {
      await deleteImage(uploaded.blobName).catch(() => {});
    }
    console.error('POST /api/client/profile/photo error', err);
    return errorResponse(res, 500, 'PROFILE_PHOTO_UPLOAD_FAILED', 'Your photo could not be uploaded.');
  }
});

router.post('/password-reset-ticket', sensitiveLimiter, async (req, res) => {
  try {
    const frontendUrl = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
    const ticket = await createPasswordChangeTicket(req.user.sub, `${frontendUrl || 'http://localhost:3006'}/portal/profile`);
    return res.json({ data: { url: ticket.ticket } });
  } catch (err) {
    console.error('POST /api/client/password-reset-ticket error', err);
    return errorResponse(res, 503, 'PASSWORD_RESET_UNAVAILABLE', 'Password reset is temporarily unavailable.');
  }
});

router.delete('/account', sensitiveLimiter, async (req, res) => {
  if (req.body?.confirmation !== 'DELETE') {
    return validationError(res, { confirmation: 'Type DELETE to confirm permanent account deletion.' });
  }
  const auth0Sub = req.user.sub;
  let identityBlocked = false;
  try {
    const userResult = await pool.query(
      `SELECT profile_picture_blob_name, profile_picture_storage_provider
       FROM users WHERE id = $1`,
      [req.clientId]
    );
    await setBlocked(auth0Sub, true);
    identityBlocked = true;
    await pool.query('DELETE FROM users WHERE id = $1', [req.clientId]);
    await deleteAuth0User(auth0Sub);
    const blobName = userResult.rows[0]?.profile_picture_blob_name;
    if (userResult.rows[0]?.profile_picture_storage_provider === 'azure_blob' && blobName) {
      deleteImage(blobName).catch((err) => {
        console.error('Could not remove deleted Azure profile photo', err?.message || err);
      });
    }
    return res.status(204).send();
  } catch (err) {
    console.error('DELETE /api/client/account error', err);
    if (!identityBlocked) {
      return errorResponse(res, 503, 'ACCOUNT_DELETION_UNAVAILABLE', 'Account deletion is temporarily unavailable.');
    }
    return errorResponse(
      res,
      503,
      'ACCOUNT_DELETION_INCOMPLETE',
      'Your account was secured, but deletion could not be fully completed. Please contact support.'
    );
  }
});

module.exports = router;
