const pool = require('../db');

/**
 * Automatically match a client with suitable therapists based on intake form data
 * Returns array of therapist IDs ranked by match score
 */
async function findMatchingTherapists(intakeFormData) {
  try {
    const {
      concernSeverity,
      mainConcerns,
      religiousPractice,
      suicidalThoughts,
      traumaHistory,
      anxietySymptoms,
      moodSymptoms
    } = intakeFormData;

    // Determine needed specialties based on intake form
    const neededSpecialties = [];
    
    if (suicidalThoughts) neededSpecialties.push('Crisis Intervention', 'Depression');
    if (traumaHistory && traumaHistory.length > 0) neededSpecialties.push('Trauma', 'PTSD');
    if (anxietySymptoms && anxietySymptoms.length > 0) neededSpecialties.push('Anxiety');
    if (moodSymptoms && moodSymptoms.length > 0) neededSpecialties.push('Depression');
    
    // Parse main concerns for keywords
    const concerns = (mainConcerns || '').toLowerCase();
    if (concerns.includes('marriage') || concerns.includes('relationship')) neededSpecialties.push('Family Therapy');
    if (concerns.includes('addiction')) neededSpecialties.push('Addiction');
    if (concerns.includes('grief') || concerns.includes('loss')) neededSpecialties.push('Grief');
    if (concerns.includes('stress')) neededSpecialties.push('Stress Management');

    // Get approved therapists with their current client count
    const therapistsQuery = `
      SELECT 
        t.id,
        t.full_name,
        t.email,
        t.specialties,
        COUNT(tc.id) as client_count
      FROM therapists t
      LEFT JOIN therapist_clients tc ON t.id = tc.therapist_id AND tc.status = 'active'
      WHERE t.status = 'approved'
      GROUP BY t.id, t.full_name, t.email, t.specialties
      ORDER BY client_count ASC
    `;

    const { rows: therapists } = await pool.query(therapistsQuery);

    // Score each therapist based on specialty match and workload
    const scoredTherapists = therapists.map(therapist => {
      let score = 0;
      const therapistSpecialties = Array.isArray(therapist.specialties)
        ? therapist.specialties
        : therapist.specialties
          ? therapist.specialties.split(',').map(s => s.trim())
          : [];

      // Match score: +10 for each matching specialty
      neededSpecialties.forEach(needed => {
        if (therapistSpecialties.some(ts => ts.toLowerCase().includes(needed.toLowerCase()))) {
          score += 10;
        }
      });

      // Workload score: prefer therapists with fewer clients (max 5 bonus points)
      const workloadBonus = Math.max(0, 5 - Math.floor(therapist.client_count / 2));
      score += workloadBonus;

      // Severity bonus: if severe case, prioritize more experienced (those with some clients)
      if (concernSeverity === 'severe' && therapist.client_count > 0 && therapist.client_count < 10) {
        score += 3;
      }

      return {
        ...therapist,
        score,
        matchedSpecialties: therapistSpecialties.filter(ts => 
          neededSpecialties.some(ns => ts.toLowerCase().includes(ns.toLowerCase()))
        )
      };
    });

    // Sort by score (highest first)
    scoredTherapists.sort((a, b) => b.score - a.score);

    return scoredTherapists;

  } catch (error) {
    console.error('Matching service error:', error);
    throw error;
  }
}

/**
 * Automatically assign client to best-matched therapist
 */
async function autoAssignTherapist(userId, intakeFormData) {
  try {
    // Find matching therapists
    const matchedTherapists = await findMatchingTherapists(intakeFormData);

    if (matchedTherapists.length === 0) {
      console.log('No approved therapists available for auto-assignment');
      return null;
    }

    // Get the best match (highest score)
    const bestMatch = matchedTherapists[0];

    // Check if already assigned
    const existingAssignment = await pool.query(
      'SELECT id FROM therapist_clients WHERE client_id = $1 AND therapist_id = $2',
      [userId, bestMatch.id]
    );

    if (existingAssignment.rows.length > 0) {
      console.log(`Client ${userId} already assigned to therapist ${bestMatch.id}`);
      return {
        assignment: existingAssignment.rows[0],
        therapist: bestMatch,
        matchScore: bestMatch.score,
        matchedSpecialties: bestMatch.matchedSpecialties
      };
    }

    // Create auto-assignment
    const result = await pool.query(
      `INSERT INTO therapist_clients (therapist_id, client_id, status, assignment_source, assigned_at)
       VALUES ($1, $2, 'active', 'auto', NOW())
       RETURNING *`,
      [bestMatch.id, userId]
    );

    console.log(`Auto-assigned client ${userId} to therapist ${bestMatch.full_name} (score: ${bestMatch.score})`);

    return {
      assignment: result.rows[0],
      therapist: bestMatch,
      matchScore: bestMatch.score,
      matchedSpecialties: bestMatch.matchedSpecialties
    };

  } catch (error) {
    console.error('Auto-assignment error:', error);
    throw error;
  }
}

module.exports = {
  findMatchingTherapists,
  autoAssignTherapist
};
