const express = require('express');
const pool = require('../db');
const { requireClient } = require('../middleware/requireClient');
const { csrfProtection } = require('../middleware/csrf');
const { errorResponse } = require('../utils/apiResponse');

const router = express.Router();

router.use(requireClient);
router.use(csrfProtection);

// The portal shell uses this lightweight endpoint to make server state—not
// local storage—the authority for onboarding and client feature availability.
router.get('/bootstrap', async (req, res) => {
  try {
    const [clientResult, featureResult] = await Promise.all([
      pool.query(
        `SELECT id, email, full_name, first_name, last_name, profile_picture,
                onboarding_completed_at, timezone
         FROM users WHERE id = $1`,
        [req.clientId]
      ),
      pool.query(
        `SELECT setting_value FROM platform_settings
         WHERE setting_key = 'client_portal_features'`
      ),
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
          profilePicture: client.profile_picture,
          timezone: client.timezone,
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

module.exports = router;
