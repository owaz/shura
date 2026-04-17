const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth').authenticateToken;
// Secure join session endpoint
router.post('/join', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.body;
    const userId = req.user.id;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId required' });
    }

    // TODO: Sessions table not yet created - using mock data for now
    // const sessionResult = await pool.query(
    //   'SELECT * FROM sessions WHERE id = $1',
    //   [sessionId]
    // );
    // if (!sessionResult.rows.length) {
    //   return res.status(404).json({ error: 'Session not found' });
    // }
    // const session = sessionResult.rows[0];

    // Mock session data for development
    const session = {
      id: sessionId,
      status: 'live',
      client_id: userId, // Allow current user to join
      therapist_id: 1,
      start_time: new Date(),
      end_time: new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now
    };

    // Check if session is live (start_time <= now <= end_time, status = 'live')
    const now = new Date();
    if (
      session.status !== 'live' ||
      !(new Date(session.start_time) <= now && now <= new Date(session.end_time))
    ) {
      return res.status(403).json({ error: 'Session is not live' });
    }

    // Check if user is a participant (client or assigned therapist)
    if (userId !== session.client_id && userId !== session.therapist_id) {
      return res.status(403).json({ error: 'Not authorized for this session' });
    }

    // TODO: Log join attempt when logs table is ready
    // await pool.query(
    //   'INSERT INTO record_access_logs (user_id, session_id, action, timestamp) VALUES ($1, $2, $3, NOW())',
    //   [userId, sessionId, 'join']
    // );

    // TODO: Integrate with video provider to generate a secure token/link
    // For now, return a placeholder
    return res.json({
      ok: true,
      message: 'Session join authorized',
      videoToken: 'PLACEHOLDER_VIDEO_TOKEN',
      sessionId
    });
  } catch (err) {
    console.error('Join session error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Simple placeholder routes for calls management
// These endpoints are lightweight helpers; real-time signaling is handled by socket.io

// Create a call (returns a simple call id)
router.post('/create', async (req, res) => {
  try {
    // In production you might insert a call record into DB. For now return a random id.
    const callId = Math.random().toString(36).substring(2, 9);
    res.json({ ok: true, callId });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Simple health for calls
router.get('/health', (req, res) => {
  res.json({ ok: true, message: 'Calls route healthy' });
});

module.exports = router;
