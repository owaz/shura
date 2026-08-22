const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAdmin } = require('../middleware/auth');

router.post('/login', async (req, res) => {
  return res.status(410).json({
    error: 'Admin password login has been removed. Use Auth0 Universal Login with admin role and MFA.',
  });
});

router.get('/profile', requireAdmin, async (req, res) => {
  try {
    const adminId = req.admin?.id;
    if (!adminId) return res.status(401).json({ error: 'No token' });
    const { rows } = await pool.query('SELECT id, email, full_name, role, phone FROM admins WHERE id = $1', [adminId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Admin not found' });
    return res.json({ admin: rows[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Unable to load the admin profile.' });
  }
});

router.put('/profile', requireAdmin, async (req, res) => {
  try {
    const adminId = req.admin?.id;
    if (!adminId) return res.status(401).json({ error: 'No token' });
    const { full_name, phone } = req.body;
    const { rows } = await pool.query('UPDATE admins SET full_name = COALESCE($1, full_name), phone = COALESCE($2, phone), updated_at = NOW() WHERE id = $3 RETURNING id, email, full_name, role, phone', [full_name, phone, adminId]);
    return res.json({ admin: rows[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Unable to update the admin profile.' });
  }
});

router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const [clients, therapists, assignments, forms] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM users'),
      pool.query('SELECT COUNT(*) as count FROM therapists WHERE status = $1', ['approved']),
      pool.query('SELECT COUNT(*) as count FROM therapist_clients WHERE status = $1', ['active']),
      pool.query('SELECT COUNT(*) as count FROM intake_forms')
    ]);
    return res.json({ stats: { totalClients: parseInt(clients.rows[0].count), activeTherapists: parseInt(therapists.rows[0].count), activeAssignments: parseInt(assignments.rows[0].count), totalIntakeForms: parseInt(forms.rows[0].count) } });
  } catch (err) {
    return res.status(500).json({ error: 'Unable to load admin statistics.' });
  }
});

router.get('/intake-forms', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        if.id,
        if.user_id,
        u.full_name as user_name,
        u.email as user_email,
        if.main_concerns,
        if.concern_severity,
        if.previous_therapy,
        if.medication,
        if.suicidal_thoughts,
        if.submitted_at
      FROM intake_forms if
      JOIN users u ON u.id = if.user_id
      ORDER BY if.submitted_at DESC
    `);
    
    return res.json({ forms: rows });
  } catch (err) {
    return res.status(500).json({ error: 'Unable to load intake forms.' });
  }
});

module.exports = router;
