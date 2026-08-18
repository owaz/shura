const express = require('express');
const pool = require('../db');
const { requireClient } = require('../middleware/requireClient');
const { errorResponse } = require('../utils/apiResponse');
const { utcDateKey, utcDayOrdinal } = require('../utils/clientDashboard');

const router = express.Router();

router.get('/quote-of-the-day', async (_req, res) => {
  const now = new Date();
  const date = utcDateKey(now);
  const ordinal = utcDayOrdinal(now);
  try {
    const { rows } = await pool.query(
      `SELECT id, arabic_text, english_translation, source,
              arabic_attribution, translation_attribution
       FROM (
         SELECT id, arabic_text, english_translation, source,
                arabic_attribution, translation_attribution,
                ROW_NUMBER() OVER (ORDER BY id ASC) AS position,
                COUNT(*) OVER () AS total
         FROM islamic_quotes
         WHERE is_active = TRUE AND editorial_status = 'approved'
       ) approved_quotes
       WHERE position = MOD($1::bigint, total)::bigint + 1
       LIMIT 1`,
      [ordinal]
    );
    const quote = rows[0] ? {
      id: rows[0].id,
      arabicText: rows[0].arabic_text,
      englishTranslation: rows[0].english_translation,
      source: rows[0].source,
      arabicAttribution: rows[0].arabic_attribution || null,
      translationAttribution: rows[0].translation_attribution || null,
    } : null;
    const nextUtcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
    const maxAge = Math.max(0, Math.min(300, Math.ceil((nextUtcMidnight - now.getTime()) / 1000)));
    res.set('Cache-Control', `public, max-age=${maxAge}`);
    return res.json({
      data: {
        date,
        dateBoundary: 'UTC',
        quote,
        editorialReviewRequired: !quote,
      },
    });
  } catch (error) {
    console.error('GET /api/platform/quote-of-the-day error', error);
    return errorResponse(res, 500, 'QUOTE_LOAD_FAILED', 'The quote of the day could not be loaded.');
  }
});

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
