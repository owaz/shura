// routes/newsletter.js
const express = require('express');
const pool = require('../db');
const router = express.Router();

const MAX_EMAIL_LENGTH = 254;
const MAX_NAME_LENGTH = 120;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');
const normalizeName = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, MAX_NAME_LENGTH) : null;
};

const validateEmail = (email) => {
  if (!email) return 'Email is required';
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(email)) return 'A valid email is required';
  return null;
};

// Subscribe to newsletter
router.post('/subscribe', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const emailError = validateEmail(email);
    if (emailError) {
      return res.status(400).json({ error: emailError });
    }

    const name = normalizeName(req.body.name);
    const optIn = req.body.optIn === true;

    const q = `
      INSERT INTO newsletter (email, name, opt_in, subscribed, unsubscribed_at, updated_at)
      VALUES ($1, $2, $3, true, NULL, NOW())
      ON CONFLICT (email) DO UPDATE SET
        name = COALESCE(EXCLUDED.name, newsletter.name),
        opt_in = EXCLUDED.opt_in,
        subscribed = true,
        unsubscribed_at = NULL,
        updated_at = NOW()
      RETURNING id, email, name, opt_in, subscribed
    `;
    const { rows } = await pool.query(q, [email, name, optIn]);

    res.json({
      message: 'Successfully subscribed',
      subscription: rows[0],
    });
  } catch (err) {
    console.error('Newsletter subscribe error:', err);
    res.status(500).json({ error: 'Unable to update newsletter subscription' });
  }
});

// Unsubscribe from newsletter
router.post('/unsubscribe', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const emailError = validateEmail(email);
    if (emailError) {
      return res.status(400).json({ error: emailError });
    }

    await pool.query(
      `UPDATE newsletter
       SET subscribed = false, unsubscribed_at = NOW(), updated_at = NOW()
       WHERE email = $1`,
      [email]
    );
    res.json({ message: 'Successfully unsubscribed' });
  } catch (err) {
    console.error('Newsletter unsubscribe error:', err);
    res.status(500).json({ error: 'Unable to update newsletter subscription' });
  }
});

module.exports = router;
