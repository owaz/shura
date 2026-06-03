const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const {
  buildAuthorizationUrl,
  exchangeAuthorizationCode,
  frontendBaseUrl,
  providerConfig,
  providerConfigured,
  saveIntegration,
  verifyOAuthState,
} = require('../utils/calendarIntegrations');

const router = express.Router();

const requireTherapist = (req, res, next) => {
  authenticateToken(req, res, () => {
    if (req.user?.role !== 'therapist') {
      return res.status(403).json({ error: 'Therapist access required' });
    }
    next();
  });
};

const normalizeProvider = (provider) => String(provider || '').toLowerCase();

router.get('/integrations', requireTherapist, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT provider, provider_account_email, status, last_error, updated_at
       FROM therapist_calendar_integrations
       WHERE therapist_id = $1
       ORDER BY provider ASC`,
      [req.user.id]
    );

    const byProvider = Object.fromEntries(result.rows.map((row) => [row.provider, row]));
    const integrations = ['google', 'outlook'].map((provider) => ({
      provider,
      name: providerConfig(provider).name,
      configured: providerConfigured(provider),
      status: byProvider[provider]?.status || 'not_connected',
      accountEmail: byProvider[provider]?.provider_account_email || null,
      lastError: byProvider[provider]?.last_error || null,
      updatedAt: byProvider[provider]?.updated_at || null,
    }));

    res.json({ integrations });
  } catch (err) {
    console.error('Calendar integrations list error:', err);
    res.status(500).json({ error: 'Failed to load calendar integrations' });
  }
});

router.get('/:provider/connect', requireTherapist, async (req, res) => {
  try {
    const provider = normalizeProvider(req.params.provider);
    if (!providerConfig(provider)) {
      return res.status(404).json({ error: 'Calendar provider not supported' });
    }
    if (!providerConfigured(provider)) {
      return res.status(400).json({ error: `${providerConfig(provider).name} OAuth is not configured` });
    }

    res.json({ authUrl: buildAuthorizationUrl({ provider, therapistId: req.user.id }) });
  } catch (err) {
    console.error('Calendar connect error:', err);
    res.status(500).json({ error: 'Failed to start calendar connection' });
  }
});

router.get('/:provider/callback', async (req, res) => {
  const provider = normalizeProvider(req.params.provider);
  try {
    if (!providerConfig(provider)) {
      return res.redirect(`${frontendBaseUrl()}/therapist-portal/calendar?calendar=unsupported`);
    }

    const { code, state, error } = req.query;
    if (error) {
      return res.redirect(`${frontendBaseUrl()}/therapist-portal/calendar?calendar=denied&provider=${provider}`);
    }
    if (!code || !state) {
      return res.redirect(`${frontendBaseUrl()}/therapist-portal/calendar?calendar=missing&provider=${provider}`);
    }

    const payload = verifyOAuthState(state, provider);
    const tokenData = await exchangeAuthorizationCode({ provider, code });
    await saveIntegration({ therapistId: payload.therapistId, provider, tokenData });

    res.redirect(`${frontendBaseUrl()}/therapist-portal/calendar?calendar=connected&provider=${provider}`);
  } catch (err) {
    console.error('Calendar callback error:', err);
    res.redirect(`${frontendBaseUrl()}/therapist-portal/calendar?calendar=failed&provider=${provider}`);
  }
});

router.delete('/:provider', requireTherapist, async (req, res) => {
  try {
    const provider = normalizeProvider(req.params.provider);
    if (!providerConfig(provider)) {
      return res.status(404).json({ error: 'Calendar provider not supported' });
    }

    await pool.query(
      `UPDATE therapist_calendar_integrations
       SET status = 'disconnected',
           access_token_enc = NULL,
           refresh_token_enc = NULL,
           updated_at = NOW()
       WHERE therapist_id = $1 AND provider = $2`,
      [req.user.id, provider]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Calendar disconnect error:', err);
    res.status(500).json({ error: 'Failed to disconnect calendar' });
  }
});

module.exports = router;
