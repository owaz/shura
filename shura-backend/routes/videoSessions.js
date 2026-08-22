const express = require('express');
const rateLimit = require('express-rate-limit');
const { authenticateToken } = require('../middleware/auth');
const { errorResponse } = require('../utils/apiResponse');
const {
  VideoSessionServiceError,
  createVideoSessionService,
} = require('../services/video/videoSessionService');

const router = express.Router();
const videoSessionService = createVideoSessionService();

const joinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

const parseBookingId = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const respondServiceError = (res, error, fallbackCode, fallbackMessage) => {
  if (error instanceof VideoSessionServiceError) {
    return errorResponse(res, error.status, error.code, error.message, error.details || null);
  }
  return errorResponse(res, 500, fallbackCode, fallbackMessage);
};

router.get('/sessions/:bookingId', authenticateToken, async (req, res) => {
  const bookingId = parseBookingId(req.params.bookingId);
  if (!bookingId) {
    return errorResponse(res, 400, 'INVALID_BOOKING_ID', 'Choose a valid booking.');
  }

  try {
    const state = await videoSessionService.getSessionState({
      bookingId,
      principalRole: req.user?.role,
      principalId: req.user?.id,
    });
    return res.json({ data: state });
  } catch (error) {
    if (!(error instanceof VideoSessionServiceError)) {
      console.error('Get video session state error', { code: error?.code || 'SESSION_STATE_FAILED' });
    }
    return respondServiceError(
      res,
      error,
      'SESSION_STATE_FAILED',
      'We could not load this session right now.'
    );
  }
});

router.post('/sessions/:bookingId/join', authenticateToken, joinLimiter, async (req, res) => {
  const bookingId = parseBookingId(req.params.bookingId);
  if (!bookingId) {
    return errorResponse(res, 400, 'INVALID_BOOKING_ID', 'Choose a valid booking.');
  }

  try {
    const access = await videoSessionService.issueParticipantAccess({
      bookingId,
      principalRole: req.user?.role,
      principalId: req.user?.id,
      participantName: req.user?.full_name || req.user?.name || null,
    });
    return res.json({ data: access });
  } catch (error) {
    if (!(error instanceof VideoSessionServiceError)) {
      console.error('Join video session error', { code: error?.code || 'SESSION_JOIN_FAILED' });
    }
    return respondServiceError(
      res,
      error,
      'SESSION_JOIN_FAILED',
      'We could not open your session.'
    );
  }
});

router.post('/sessions/:bookingId/leave', authenticateToken, async (req, res) => {
  const bookingId = parseBookingId(req.params.bookingId);
  if (!bookingId) {
    return errorResponse(res, 400, 'INVALID_BOOKING_ID', 'Choose a valid booking.');
  }

  try {
    const result = await videoSessionService.signalLeave({
      bookingId,
      principalRole: req.user?.role,
      principalId: req.user?.id,
    });
    return res.json({ data: result });
  } catch (error) {
    if (!(error instanceof VideoSessionServiceError)) {
      console.error('Leave video session error', { code: error?.code || 'SESSION_LEAVE_FAILED' });
    }
    return respondServiceError(
      res,
      error,
      'SESSION_LEAVE_FAILED',
      'We could not process this leave request right now.'
    );
  }
});

module.exports = router;
