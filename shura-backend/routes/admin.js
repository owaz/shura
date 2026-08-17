const express = require('express');
const router = express.Router();
const pool = require('../db');
const { createClientNotification } = require('../services/clientNotifications');
const { findMatchingTherapists } = require('../utils/matchingService');
const { requireAdmin } = require('../middleware/auth');
const { assignRoles, searchUsers, setBlocked, updateAppMetadata } = require('../services/auth0Management');

const therapistRoleIds = () =>
  String(process.env.AUTH0_ROLE_THERAPIST_ID || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const syncTherapistAuth0State = async ({ auth0Sub, status }) => {
  if (!auth0Sub) return;
  const blocked = status === 'rejected' || status === 'suspended';
  await updateAppMetadata(auth0Sub, { role: 'therapist', status });
  await setBlocked(auth0Sub, blocked);
  if (status === 'approved') {
    await assignRoles(auth0Sub, therapistRoleIds());
  }
};

const syncClientAuth0State = async ({ auth0Sub, status }) => {
  if (!auth0Sub) return;
  const blocked = status === 'suspended';
  await updateAppMetadata(auth0Sub, { role: 'client', status });
  await setBlocked(auth0Sub, blocked);
};

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
        await createClientNotification(pool, {
          clientId,
          type: 'therapist_assigned',
          title: 'Your therapist is ready',
          body: `You have been assigned to ${therapistCheck.rows[0].full_name}.`,
          metadata: { therapistId },
        }).catch((notificationError) => {
          console.error('Assignment notification insert failed', { code: notificationError?.code || 'NOTIFICATION_FAILED' });
        });
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

    await createClientNotification(pool, {
      clientId,
      type: 'therapist_assigned',
      title: 'Your therapist is ready',
      body: `You have been assigned to ${therapistCheck.rows[0].full_name}.`,
      metadata: { therapistId },
      dedupeKey: `therapist-assigned:${result.rows[0].id}`,
    }).catch((notificationError) => {
      console.error('Assignment notification insert failed', { code: notificationError?.code || 'NOTIFICATION_FAILED' });
    });

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
        auth0_sub,
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

    const toList = (value) => {
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
      return [];
    };

    const pending = result.rows.map((t) => ({
      ...t,
      specialties: toList(t.specialties),
      session_types: toList(t.session_types),
      availability: toList(t.availability),
    }));

    res.json({ therapists: pending });
  } catch (error) {
    console.error('Error fetching pending therapists:', error);
    res.status(500).json({ error: 'Failed to fetch pending therapists' });
  }
});

const updateTherapistStatus = async ({ therapistId, nextStatus, allowedFrom, reason, adminId }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query(
      `SELECT id, auth0_sub, full_name, email, status
       FROM therapists
       WHERE id = $1
       FOR UPDATE`,
      [therapistId]
    );
    if (!current.rows.length) {
      await client.query('ROLLBACK');
      return { notFound: true };
    }

    const therapist = current.rows[0];
    if (allowedFrom.length && !allowedFrom.includes(therapist.status)) {
      await client.query('ROLLBACK');
      return { invalidState: therapist.status };
    }

    await syncTherapistAuth0State({ auth0Sub: therapist.auth0_sub, status: nextStatus });

    const updated = await client.query(
      `UPDATE therapists
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, auth0_sub, full_name, email, status`,
      [nextStatus, therapistId]
    );

    await client.query('COMMIT');
    return { therapist: updated.rows[0], reason, actor_admin_id: adminId };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};

router.post('/therapists/:id/approve', requireAdmin, async (req, res) => {
  try {
    const result = await updateTherapistStatus({
      therapistId: req.params.id,
      nextStatus: 'approved',
      allowedFrom: ['pending', 'suspended'],
      adminId: req.admin.id,
    });
    if (result.notFound) return res.status(404).json({ error: 'Therapist not found' });
    if (result.invalidState) {
      return res.status(409).json({ error: `Invalid transition from ${result.invalidState} to approved` });
    }
    res.json({ message: 'Therapist approved successfully', therapist: result.therapist });
  } catch (error) {
    console.error('Error approving therapist:', error);
    res.status(500).json({ error: 'Failed to approve therapist' });
  }
});

router.post('/therapists/:id/reject', requireAdmin, async (req, res) => {
  try {
    const reason = String(req.body?.reason || '').trim();
    if (!reason) return res.status(400).json({ error: 'reason is required to reject a therapist' });
    const result = await updateTherapistStatus({
      therapistId: req.params.id,
      nextStatus: 'rejected',
      allowedFrom: ['pending'],
      reason,
      adminId: req.admin.id,
    });
    if (result.notFound) return res.status(404).json({ error: 'Therapist not found' });
    if (result.invalidState) {
      return res.status(409).json({ error: `Invalid transition from ${result.invalidState} to rejected` });
    }
    res.json({ message: 'Therapist application rejected', therapist: result.therapist, reason });
  } catch (error) {
    console.error('Error rejecting therapist:', error);
    res.status(500).json({ error: 'Failed to reject therapist' });
  }
});

router.post('/therapists/:id/suspend', requireAdmin, async (req, res) => {
  try {
    const result = await updateTherapistStatus({
      therapistId: req.params.id,
      nextStatus: 'suspended',
      allowedFrom: ['approved'],
      adminId: req.admin.id,
    });
    if (result.notFound) return res.status(404).json({ error: 'Therapist not found' });
    if (result.invalidState) {
      return res.status(409).json({ error: `Invalid transition from ${result.invalidState} to suspended` });
    }
    res.json({ message: 'Therapist suspended successfully', therapist: result.therapist });
  } catch (error) {
    console.error('Error suspending therapist:', error);
    res.status(500).json({ error: 'Failed to suspend therapist' });
  }
});

router.post('/therapists/:id/reactivate', requireAdmin, async (req, res) => {
  try {
    const result = await updateTherapistStatus({
      therapistId: req.params.id,
      nextStatus: 'approved',
      allowedFrom: ['suspended'],
      adminId: req.admin.id,
    });
    if (result.notFound) return res.status(404).json({ error: 'Therapist not found' });
    if (result.invalidState) {
      return res.status(409).json({ error: `Invalid transition from ${result.invalidState} to approved` });
    }
    res.json({ message: 'Therapist reactivated successfully', therapist: result.therapist });
  } catch (error) {
    console.error('Error reactivating therapist:', error);
    res.status(500).json({ error: 'Failed to reactivate therapist' });
  }
});

router.post('/clients/:id/suspend', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE users
       SET status = 'suspended', updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, full_name, status, auth0_sub`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Client not found' });
    await syncClientAuth0State({ auth0Sub: rows[0].auth0_sub, status: 'suspended' });
    res.json({ message: 'Client suspended successfully', client: rows[0] });
  } catch (error) {
    console.error('Error suspending client:', error);
    res.status(500).json({ error: 'Failed to suspend client' });
  }
});

router.post('/clients/:id/reactivate', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE users
       SET status = 'active', updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, full_name, status, auth0_sub`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Client not found' });
    await syncClientAuth0State({ auth0Sub: rows[0].auth0_sub, status: 'active' });
    res.json({ message: 'Client reactivated successfully', client: rows[0] });
  } catch (error) {
    console.error('Error reactivating client:', error);
    res.status(500).json({ error: 'Failed to reactivate client' });
  }
});

router.get('/users/search', requireAdmin, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.status(400).json({ error: 'q query parameter is required' });
    const sqlLike = `%${q.toLowerCase()}%`;
    const local = await pool.query(
      `SELECT 'client'::text AS type, id, auth0_sub, email, full_name, status
       FROM users
       WHERE LOWER(email) LIKE $1 OR LOWER(COALESCE(full_name, '')) LIKE $1
       UNION ALL
       SELECT 'therapist'::text AS type, id, auth0_sub, email, full_name, status
       FROM therapists
       WHERE LOWER(email) LIKE $1 OR LOWER(COALESCE(full_name, '')) LIKE $1
       ORDER BY type, full_name NULLS LAST, email
       LIMIT 100`,
      [sqlLike]
    );
    const remote = await searchUsers(`email:*${q}* OR name:*${q}*`, 0, 25);
    res.json({ users: local.rows, auth0Users: remote });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

module.exports = router;
