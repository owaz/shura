// routes/newsletter.js
const express = require('express');
const pool = require('../db');
const router = express.Router();

// Subscribe to newsletter
router.post('/subscribe', async (req, res) => {
  try {
    const { email, name, optIn } = req.body;

    // Validation
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if already subscribed
    const exists = await pool.query('SELECT id FROM newsletter WHERE email = $1', [email]);

    if (exists.rows.length) {
      // Update existing subscription
      await pool.query('UPDATE newsletter SET opt_in = $1, updated_at = NOW() WHERE email = $2', [optIn, email]);
      return res.json({ message: 'Subscription updated' });
    }

    // Create new subscription
    const q = `INSERT INTO newsletter (email, name, opt_in) VALUES ($1, $2, $3) RETURNING id, email`;
    const { rows } = await pool.query(q, [email, name || null, optIn]);

    res.json({
      message: 'Successfully subscribed',
      subscription: rows[0],
    });
  } catch (err) {
    console.error('Newsletter subscribe error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Unsubscribe from newsletter
router.post('/unsubscribe', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    await pool.query('DELETE FROM newsletter WHERE email = $1', [email]);
    res.json({ message: 'Successfully unsubscribed' });
  } catch (err) {
    console.error('Newsletter unsubscribe error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
