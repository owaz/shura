const express = require('express');
const router = express.Router();
const pool = require('../db');
const { findMatchingTherapists } = require('../utils/matchingService');
const { requireAdmin } = require('../middleware/auth');

// Get all clients (users with intake forms)
router.get('/clients', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT 
        u.id,
        u.full_name,
        u.email,
        u.created_at,
        COUNT(if.id) as intake_forms_count,
        (SELECT COUNT(*) FROM therapist_clients tc WHERE tc.client_id = u.id AND tc.status = 'active') as assigned_therapists_count
      FROM users u
      LEFT JOIN intake_forms if ON u.id = if.user_id
      GROUP BY u.id, u.full_name, u.email, u.created_at
      ORDER BY u.created_at DESC`
    );

    res.json({ clients: result.rows });
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

// Get all therapists
router.get('/therapists', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        t.id,
        t.full_name,
        t.email,
        t.specialties,
        t.status,
        t.created_at,
        COUNT(tc.id) as assigned_clients_count
      FROM therapists t
      LEFT JOIN therapist_clients tc ON t.id = tc.therapist_id AND tc.status = 'active'
      WHERE t.status = 'approved'
      GROUP BY t.id, t.full_name, t.email, t.specialties, t.status, t.created_at
      ORDER BY t.full_name ASC`
    );

    // Parse specialties as array
    const therapists = result.rows.map(t => ({
      ...t,
      specialties: t.specialties ? t.specialties.split(',').map(s => s.trim()) : []
    }));

    res.json({ therapists });
  } catch (error) {
    console.error('Error fetching therapists:', error);
    res.status(500).json({ error: 'Failed to fetch therapists' });
  }
});

// Get assignments for a specific client
router.get('/clients/:clientId/assignments', requireAdmin, async (req, res) => {
  try {
    const { clientId } = req.params;

    const result = await pool.query(
      `SELECT 
        tc.id,
        tc.therapist_id,
        tc.assigned_at,
        tc.status,
        t.full_name as therapist_name,
        t.email as therapist_email,
        t.specialties
      FROM therapist_clients tc
      JOIN therapists t ON tc.therapist_id = t.id
      WHERE tc.client_id = $1
      ORDER BY tc.assigned_at DESC`,
      [clientId]
    );

    res.json({ assignments: result.rows });
  } catch (error) {
    console.error('Error fetching client assignments:', error);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// Assign client to therapist
router.post('/assign', requireAdmin, async (req, res) => {
  try {
    const { clientId, therapistId } = req.body;

    if (!clientId || !therapistId) {
      return res.status(400).json({ error: 'Client ID and Therapist ID are required' });
    }

    // Check if client exists
    const clientCheck = await pool.query('SELECT id FROM users WHERE id = $1', [clientId]);
    if (clientCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Check if therapist exists and is approved
    const therapistCheck = await pool.query(
      'SELECT id, full_name, email FROM therapists WHERE id = $1 AND status = $2',
      [therapistId, 'approved']
    );
    if (therapistCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Therapist not found or not approved' });
    }

    // Check if assignment already exists
    const existingAssignment = await pool.query(
      'SELECT id, status FROM therapist_clients WHERE therapist_id = $1 AND client_id = $2',
      [therapistId, clientId]
    );

    if (existingAssignment.rows.length > 0) {
      // If exists but inactive, reactivate it
      if (existingAssignment.rows[0].status === 'inactive') {
        await pool.query(
          'UPDATE therapist_clients SET status = $1, assigned_at = NOW() WHERE id = $2',
          ['active', existingAssignment.rows[0].id]
        );
        return res.json({ 
          message: 'Client assignment reactivated',
          assignment: { id: existingAssignment.rows[0].id, therapistId, clientId, status: 'active' }
        });
      } else {
        return res.status(400).json({ error: 'Client is already assigned to this therapist' });
      }
    }

    // Create new assignment
    const result = await pool.query(
      `INSERT INTO therapist_clients (therapist_id, client_id, status, assignment_source)
       VALUES ($1, $2, $3, $4)
       RETURNING id, therapist_id, client_id, assigned_at, status, assignment_source`,
      [therapistId, clientId, 'active', 'manual']
    );

    res.status(201).json({ 
      message: 'Client assigned successfully',
      assignment: result.rows[0]
    });
  } catch (error) {
    console.error('Error assigning client:', error);
    res.status(500).json({ error: 'Failed to assign client' });
  }
});

// Unassign client from therapist
router.delete('/assign/:assignmentId', requireAdmin, async (req, res) => {
  try {
    const { assignmentId } = req.params;

    // Mark as inactive instead of deleting (for history)
    const result = await pool.query(
      'UPDATE therapist_clients SET status = $1 WHERE id = $2 RETURNING *',
      ['inactive', assignmentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    res.json({ 
      message: 'Client unassigned successfully',
      assignment: result.rows[0]
    });
  } catch (error) {
    console.error('Error unassigning client:', error);
    res.status(500).json({ error: 'Failed to unassign client' });
  }
});

// Get all active assignments (overview)
router.get('/assignments', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        tc.id,
        tc.assigned_at,
        tc.status,
        tc.assignment_source,
        u.id as client_id,
        u.full_name as client_name,
        u.email as client_email,
        t.id as therapist_id,
        t.full_name as therapist_name,
        t.email as therapist_email,
        t.specialties as therapist_specialties
      FROM therapist_clients tc
      JOIN users u ON tc.client_id = u.id
      JOIN therapists t ON tc.therapist_id = t.id
      WHERE tc.status = 'active'
      ORDER BY tc.assigned_at DESC`
    );

    // Parse therapist_specialties as array
    const assignments = result.rows.map(a => ({
      ...a,
      therapist_specialties: a.therapist_specialties ? a.therapist_specialties.split(',').map(s => s.trim()) : []
    }));

    res.json({ assignments });
  } catch (error) {
    console.error('Error fetching assignments:', error);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// Get matching therapist suggestions for a client
router.get('/clients/:clientId/matches', requireAdmin, async (req, res) => {
  try {
    const { clientId } = req.params;

    // Get client's most recent intake form
    const intakeResult = await pool.query(
      `SELECT * FROM intake_forms WHERE user_id = $1 ORDER BY submitted_at DESC LIMIT 1`,
      [clientId]
    );

    if (intakeResult.rows.length === 0) {
      return res.status(404).json({ error: 'No intake form found for this client' });
    }

    const intakeForm = intakeResult.rows[0];
    
    // Get matching therapists with scores
    const matches = await findMatchingTherapists({
      concernSeverity: intakeForm.concern_severity,
      mainConcerns: intakeForm.main_concerns,
      religiousPractice: intakeForm.religious_practice,
      suicidalThoughts: intakeForm.suicidal_thoughts,
      traumaHistory: intakeForm.trauma_history,
      anxietySymptoms: intakeForm.anxiety_symptoms,
      moodSymptoms: intakeForm.mood_symptoms
    });

    res.json({ 
      matches: matches.slice(0, 5), // Top 5 matches
      clientInfo: {
        id: intakeForm.user_id,
        concernSeverity: intakeForm.concern_severity,
        mainConcerns: intakeForm.main_concerns
      }
    });

  } catch (error) {
    console.error('Error getting matches:', error);
    res.status(500).json({ error: 'Failed to get matching therapists' });
  }
});

// Get pending therapist applications
router.get('/therapists/pending', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        id,
        full_name,
        email,
        phone,
        license_number,
        experience_years,
        specialties,
        session_types,
        rate_60min,
        availability,
        status,
        created_at
      FROM therapists
      WHERE status = 'pending'
      ORDER BY created_at DESC`
    );

    const pending = result.rows.map(t => ({
      ...t,
      specialties: Array.isArray(t.specialties) ? t.specialties : [],
      session_types: Array.isArray(t.session_types) ? t.session_types : [],
      availability: Array.isArray(t.availability) ? t.availability : []
    }));

    res.json({ therapists: pending });
  } catch (error) {
    console.error('Error fetching pending therapists:', error);
    res.status(500).json({ error: 'Failed to fetch pending therapists' });
  }
});

// Approve therapist
router.post('/therapists/:id/approve', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE therapists 
       SET status = 'approved', updated_at = NOW()
       WHERE id = $1 AND status = 'pending'
       RETURNING id, full_name, email, status`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Therapist not found or already processed' });
    }

    res.json({ 
      message: 'Therapist approved successfully',
      therapist: result.rows[0]
    });
  } catch (error) {
    console.error('Error approving therapist:', error);
    res.status(500).json({ error: 'Failed to approve therapist' });
  }
});

// Reject therapist
router.post('/therapists/:id/reject', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body; // Optional rejection reason

    const result = await pool.query(
      `UPDATE therapists 
       SET status = 'rejected', updated_at = NOW()
       WHERE id = $1 AND status = 'pending'
       RETURNING id, full_name, email, status`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Therapist not found or already processed' });
    }

    // TODO: Send email notification to therapist about rejection
    // if (reason) { include reason in email }

    res.json({ 
      message: 'Therapist application rejected',
      therapist: result.rows[0]
    });
  } catch (error) {
    console.error('Error rejecting therapist:', error);
    res.status(500).json({ error: 'Failed to reject therapist' });
  }
});

module.exports = router;
