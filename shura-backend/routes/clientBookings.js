const express = require('express');
const rateLimit = require('express-rate-limit');
const { errorResponse } = require('../utils/apiResponse');
const { buildBookingIcs } = require('../utils/icsCalendar');
const { validateDateRange } = require('../utils/clientBookingPolicy');
const {
  bookingOptionsDto,
  createPaidBookingIntent,
  finalizePaidBookingIntent,
  listAvailableSlots,
  loadBookingContext,
  loadOwnedBooking,
  loadOwnedIntent,
  verifyPaymentSignature,
} = require('../services/clientBookingService');

const router = express.Router();
const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

const positiveId = (value) => Number.isInteger(Number(value)) && Number(value) > 0;

const respondError = (res, error, fallbackCode, fallbackMessage) => {
  const status = Number(error.statusCode) || 500;
  if (status >= 500) console.error(`${fallbackCode} error`, { code: error.code || fallbackCode });
  return errorResponse(
    res,
    status,
    status >= 500 ? fallbackCode : error.code || fallbackCode,
    status >= 500 ? fallbackMessage : error.message,
    error.details || null
  );
};

router.get('/booking-options/:therapistId', async (req, res) => {
  if (!positiveId(req.params.therapistId)) return errorResponse(res, 400, 'INVALID_THERAPIST_ID', 'Choose a valid therapist.');
  try {
    const context = await loadBookingContext(req.clientId, Number(req.params.therapistId));
    return res.json({ data: await bookingOptionsDto(context) });
  } catch (error) {
    return respondError(res, error, 'BOOKING_OPTIONS_FAILED', 'We could not load booking options.');
  }
});

router.get('/availability/:therapistId', async (req, res) => {
  if (!positiveId(req.params.therapistId)) return errorResponse(res, 400, 'INVALID_THERAPIST_ID', 'Choose a valid therapist.');
  const range = validateDateRange(req.query.from, req.query.to);
  if (!range) return errorResponse(res, 400, 'INVALID_DATE_RANGE', 'Choose a date range of up to 31 days.');
  try {
    const data = await listAvailableSlots({
      clientId: req.clientId,
      therapistId: Number(req.params.therapistId),
      from: range.from,
      to: range.to,
      sessionType: req.query.sessionType,
      durationMinutes: Number(req.query.durationMinutes),
    });
    return res.json({ data });
  } catch (error) {
    return respondError(res, error, 'AVAILABILITY_LOAD_FAILED', 'We could not load available times.');
  }
});

router.post('/bookings', bookingLimiter, async (req, res) => {
  const therapistId = Number(req.body?.therapistId);
  if (!positiveId(therapistId)) return errorResponse(res, 400, 'INVALID_THERAPIST_ID', 'Choose a valid therapist.');
  try {
    const result = await createPaidBookingIntent({
      clientId: req.clientId,
      therapistId,
      payload: req.body,
    });
    return res.status(result.kind === 'confirmed' ? 201 : 200).json({ data: result });
  } catch (error) {
    return respondError(res, error, 'BOOKING_CREATE_FAILED', 'We could not start this booking.');
  }
});

router.post('/bookings/verify-payment', bookingLimiter, async (req, res) => {
  const orderId = String(req.body?.razorpayOrderId || '');
  const paymentId = String(req.body?.razorpayPaymentId || '');
  const signature = String(req.body?.razorpaySignature || '');
  try {
    if (!verifyPaymentSignature({ orderId, paymentId, signature })) {
      return errorResponse(res, 400, 'INVALID_PAYMENT_SIGNATURE', 'Payment verification failed.');
    }
    const result = await finalizePaidBookingIntent({ orderId, paymentId, expectedClientId: req.clientId });
    if (result.status === 'not_found') return errorResponse(res, 404, 'BOOKING_INTENT_NOT_FOUND', 'This booking payment could not be found.');
    if (result.status === 'conflict') {
      return errorResponse(res, 409, 'PAID_SLOT_CONFLICT', 'Your payment was received, but this slot is no longer available. A refund is required.', {
        orderId,
        intentStatus: 'conflict',
        refundStatus: result.intent?.refund_status || 'required',
      });
    }
    return res.json({ data: result });
  } catch (error) {
    return respondError(res, error, 'BOOKING_FINALIZE_FAILED', 'We could not verify and finalize this booking.');
  }
});

router.get('/bookings/intents/:orderId', async (req, res) => {
  try {
    const intent = await loadOwnedIntent(req.clientId, String(req.params.orderId));
    if (!intent) return errorResponse(res, 404, 'BOOKING_INTENT_NOT_FOUND', 'This booking payment could not be found.');
    return res.json({ data: { intent } });
  } catch (error) {
    return respondError(res, error, 'BOOKING_RECOVERY_FAILED', 'We could not recover this booking status.');
  }
});

router.get('/bookings/:bookingId/calendar.ics', async (req, res) => {
  if (!positiveId(req.params.bookingId)) return errorResponse(res, 400, 'INVALID_BOOKING_ID', 'Choose a valid booking.');
  try {
    const booking = await loadOwnedBooking(req.clientId, Number(req.params.bookingId));
    if (!booking) return errorResponse(res, 404, 'BOOKING_NOT_FOUND', 'This booking could not be found.');
    const ics = buildBookingIcs({
      bookingId: booking.id,
      scheduledAt: booking.scheduled_at,
      durationMinutes: booking.duration_minutes,
      therapistName: booking.therapist_name,
      sessionType: booking.session_type,
    });
    res.set({
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="shura-session-${booking.id}.ics"`,
      'Cache-Control': 'private, no-store',
    });
    return res.send(ics);
  } catch (error) {
    return respondError(res, error, 'CALENDAR_DOWNLOAD_FAILED', 'We could not create the calendar file.');
  }
});

module.exports = router;
