const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const pool = require('../db');
const { sendIntakeFormLink, sendIntakeFormSubmission } = require('../utils/emailService');
const { autoAssignTherapist } = require('../utils/matchingService');

// Generate intake form link and send to client
router.post('/generate-link', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // Get user info
    const userResult = await pool.query(
      'SELECT id, email, full_name FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userResult.rows[0];

    // Generate unique token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Store token in database
    await pool.query(
      `INSERT INTO intake_tokens (user_id, token, expires_at, created_at) 
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id) 
       DO UPDATE SET token = $2, expires_at = $3, created_at = NOW(), completed_at = NULL`,
      [userId, token, expiresAt]
    );

    // Send email with link
    const intakeLink = `http://localhost:3000/intake/${token}`;
    await sendIntakeFormLink(user.email, user.full_name, intakeLink);

    res.json({ 
      message: 'Intake form link sent successfully',
      link: intakeLink 
    });

  } catch (error) {
    console.error('Generate intake link error:', error);
    res.status(500).json({ message: 'Failed to generate intake form link' });
  }
});

// Verify token and get client info
router.get('/verify/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const result = await pool.query(
      `SELECT it.*, u.email, u.full_name 
       FROM intake_tokens it
       JOIN users u ON it.user_id = u.id
       WHERE it.token = $1 AND it.expires_at > NOW() AND it.completed_at IS NULL`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired link' });
    }

    const data = result.rows[0];
    res.json({ 
      client: {
        id: data.user_id,
        email: data.email,
        full_name: data.full_name
      }
    });

  } catch (error) {
    console.error('Verify token error:', error);
    res.status(500).json({ message: 'Failed to verify link' });
  }
});

// Submit intake form
router.post('/submit', async (req, res) => {
  try {
    const { token, ...formData } = req.body;

    // Verify token
    const tokenResult = await pool.query(
      `SELECT it.*, u.email, u.full_name 
       FROM intake_tokens it
       JOIN users u ON it.user_id = u.id
       WHERE it.token = $1 AND it.expires_at > NOW() AND it.completed_at IS NULL`,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired link' });
    }

    const client = tokenResult.rows[0];

    // Store intake form data
    await pool.query(
      `INSERT INTO intake_forms (
        user_id, 
        marital_status, has_children, children_details, living_situation,
        religious_practice, prayer_frequency, quran_engagement, community_involvement,
        main_concerns, concern_duration, concern_severity, therapy_goals,
        mood_symptoms, anxiety_symptoms, sleep_issues, appetite_issues,
        suicidal_thoughts, suicidal_details,
        trauma_history, trauma_impact, relationship_quality, relationship_difficulties,
        social_support, physical_health, medical_conditions, current_medications,
        previous_therapy, previous_therapy_details, coping_mechanisms,
        spiritual_connection, additional_info,
        submitted_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
        $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, NOW()
      )`,
      [
        client.user_id,
        formData.maritalStatus, formData.hasChildren, formData.childrenDetails, formData.livingSituation,
        formData.religiousPractice, formData.prayerFrequency, formData.quranEngagement, formData.communityInvolvement,
        formData.mainConcerns, formData.concernDuration, formData.concernSeverity, formData.therapyGoals,
        JSON.stringify(formData.moodSymptoms), JSON.stringify(formData.anxietySymptoms),
        JSON.stringify(formData.sleepIssues), JSON.stringify(formData.appetiteIssues),
        formData.suicidalThoughts, formData.suicidalDetails,
        JSON.stringify(formData.traumaHistory), formData.traumaImpact, formData.relationshipQuality,
        JSON.stringify(formData.relationshipDifficulties), formData.socialSupport,
        formData.physicalHealth, formData.medicalConditions, formData.currentMedications,
        formData.previousTherapy, formData.previousTherapyDetails,
        JSON.stringify(formData.copingMechanisms), formData.spiritualConnection, formData.additionalInfo
      ]
    );

    // Mark token as completed
    await pool.query(
      'UPDATE intake_tokens SET completed_at = NOW() WHERE token = $1',
      [token]
    );

    // Auto-assign to best-matched therapist
    let assignment = null;
    try {
      assignment = await autoAssignTherapist(client.user_id, formData);
      if (assignment) {
        console.log(`Client ${client.full_name} auto-assigned to therapist ${assignment.therapist.full_name}`);
      }
    } catch (assignError) {
      console.error('Auto-assignment failed, but form submitted:', assignError);
      // Continue even if auto-assignment fails
    }

    // Send email notification to admin with intake form data
    await sendIntakeFormSubmission(client.email, client.full_name, formData);

    res.json({ 
      message: 'Intake form submitted successfully',
      autoAssigned: assignment ? true : false,
      therapist: assignment ? {
        name: assignment.therapist.full_name,
        email: assignment.therapist.email
      } : null
    });

  } catch (error) {
    console.error('Submit intake form error:', error);
    res.status(500).json({ message: 'Failed to submit intake form' });
  }
});

// Get all intake forms for a therapist's clients
router.get('/therapist/:therapistId', async (req, res) => {
  try {
    const { therapistId } = req.params;

    // Get all completed intake forms with user info
    // For now, get all forms (later we'll filter by therapist-client relationship)
    const result = await pool.query(
      `SELECT 
        if.id,
        if.user_id,
        if.submitted_at,
        u.email,
        u.full_name,
        if.marital_status,
        if.has_children,
        if.children_details,
        if.living_situation,
        if.religious_practice,
        if.prayer_frequency,
        if.quran_engagement,
        if.community_involvement,
        if.main_concerns,
        if.concern_duration,
        if.concern_severity,
        if.therapy_goals,
        if.mood_symptoms,
        if.anxiety_symptoms,
        if.sleep_issues,
        if.appetite_issues,
        if.suicidal_thoughts,
        if.suicidal_details,
        if.trauma_history,
        if.trauma_impact,
        if.relationship_quality,
        if.relationship_difficulties,
        if.social_support,
        if.physical_health,
        if.medical_conditions,
        if.current_medications,
        if.previous_therapy,
        if.previous_therapy_details,
        if.coping_mechanisms,
        if.spiritual_connection,
        if.additional_info
       FROM intake_forms if
       JOIN users u ON if.user_id = u.id
       ORDER BY if.submitted_at DESC`,
      []
    );

    res.json({ intakeForms: result.rows });

  } catch (error) {
    console.error('Get therapist intake forms error:', error);
    res.status(500).json({ message: 'Failed to fetch intake forms' });
  }
});

module.exports = router;
