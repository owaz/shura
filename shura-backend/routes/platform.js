const express = require('express');
const pool = require('../db');
const { requireClient } = require('../middleware/requireClient');
const { errorResponse } = require('../utils/apiResponse');

const router = express.Router();

router.get('/settings/client', requireClient, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT setting_key, setting_value
       FROM platform_settings
       WHERE setting_key IN ('client_profile_options', 'client_portal_features', 'session_policies')`
    );
    const settings = Object.fromEntries(rows.map((row) => [row.setting_key, row.setting_value]));
    return res.json({
      data: {
        options: settings.client_profile_options || { languages: [], specialisations: [], phoneCountryCodes: [] },
        features: settings.client_portal_features || {},
        policies: settings.session_policies || {},
      },
    });
  } catch (err) {
    console.error('GET /api/platform/settings/client error', err);
    return errorResponse(res, 500, 'CLIENT_SETTINGS_LOAD_FAILED', 'Client settings could not be loaded.');
  }
});

module.exports = router;
