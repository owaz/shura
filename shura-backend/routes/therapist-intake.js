const express = require('express');
const router = express.Router();
const pool = require('../db');

// Get all intake forms for therapist's clients
router.get('/forms', async (req, res) => {
  try {
    const therapistId = req.user.id;

    const result = await pool.query(
      `SELECT 
        if.id,
        if.user_id,
        u.full_name as client_name,
        u.email as client_email,
        if.main_concerns,
        if.concern_severity,
        if.suicidal_thoughts,
        if.submitted_at
      FROM intake_forms if
      JOIN users u ON if.user_id = u.id
      WHERE u.id IN (
        SELECT client_id FROM therapist_clients WHERE therapist_id = $1
      )
      ORDER BY if.submitted_at DESC`,
      [therapistId]
    );

    res.json({ forms: result.rows });
  } catch (error) {
    console.error('Error fetching intake forms:', error);
    res.status(500).json({ error: 'Failed to fetch intake forms' });
  }
});

// Get single intake form details
router.get('/forms/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const therapistId = req.user.id;

    const result = await pool.query(
      `SELECT if.*, u.full_name as client_name, u.email as client_email
      FROM intake_forms if
      JOIN users u ON if.user_id = u.id
      WHERE if.id = $1 AND u.id IN (
        SELECT client_id FROM therapist_clients WHERE therapist_id = $2
      )`,
      [id, therapistId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Form not found' });
    }

    res.json({ form: result.rows[0] });
  } catch (error) {
    console.error('Error fetching intake form:', error);
    res.status(500).json({ error: 'Failed to fetch intake form' });
  }
});

module.exports = router;
