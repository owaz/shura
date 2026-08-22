const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth').authenticateToken;
const { errorResponse } = require('../utils/apiResponse');

const providerUnavailable = (_req, res) => errorResponse(
  res,
  503,
  'VIDEO_PROVIDER_UNCONFIGURED',
  'Secure video and audio sessions are not available until Shura configures a provider.'
);

router.post('/join', authenticateToken, async (req, res) => {
  return providerUnavailable(req, res);
});

// Simple placeholder routes for calls management
// These endpoints are lightweight helpers; real-time signaling is handled by socket.io

// Create a call (returns a simple call id)
router.post('/create', authenticateToken, providerUnavailable);

// Simple health for calls
router.get('/health', (req, res) => {
  res.json({ ok: true, configured: false, message: 'Secure call provider is not configured.' });
});

module.exports = router;
