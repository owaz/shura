const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const {
  sendBookingConfirmation,
  sendBookingNotificationToTherapist,
} = require('../utils/emailService');
const { syncBookingToConnectedCalendars } = require('../utils/calendarIntegrations');

const dispatchBookingNotifications = (emailData) => {
  void Promise.allSettled([
    Promise.resolve().then(() => sendBookingConfirmation(emailData)),
    Promise.resolve().then(() => sendBookingNotificationToTherapist(emailData)),
  ]).then((results) => {
    results
      .filter((result) => result.status === 'rejected')
      .forEach((result) => console.error('Booking email dispatch error:', result.reason));
  });
};

const toMinutes = (time) => {
  const [hours, minutes] = String(time).slice(0, 5).split(':').map(Number);
  return hours * 60 + minutes;
};

const toIsoDateOnly = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const asString = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(asString)) {
    return asString;
  }
  const parsed = new Date(asString);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return '';
};

const toHHMM = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(11, 16);
  }
  const asString = String(value || '').trim();
  if (/^\d{2}:\d{2}/.test(asString)) {
    return asString.slice(0, 5);
  }
  return '';
};

const getDayOfWeek = (date) => {
  const parsed = new Date(`${date}T00:00:00+05:30`);
  return parsed.getDay();
};

const slotOverlapsBlock = (date, slot, slotMinutes, block) => {
  const start = new Date(`${date}T${slot}:00+05:30`);
  const end = new Date(start.getTime() + slotMinutes * 60 * 1000);
  return start < new Date(block.ends_at) && end > new Date(block.starts_at);
};

const validatePaidIntentPayload = (payload) => {
  const therapistId = Number(payload.therapist_id);
  const date = String(payload.date || '');
  const time = String(payload.time || '').slice(0, 5);
  const sessionType = String(payload.session_type || 'video').toLowerCase();
  const amountProvided = payload.amount_cents !== undefined && payload.amount_cents !== null && payload.amount_cents !== '';
  const amountCents = amountProvided ? Number(payload.amount_cents) : null;

  if (!Number.isInteger(therapistId) || therapistId <= 0) {
    return { error: 'Valid therapist_id is required' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { error: 'Valid date is required (YYYY-MM-DD)' };
  }
  if (!/^\d{2}:\d{2}$/.test(time)) {
    return { error: 'Valid time is required (HH:MM)' };
  }
  if (!['video', 'audio', 'text', 'intro'].includes(sessionType)) {
    return { error: 'Invalid session_type' };
  }
  if (amountProvided && (!Number.isInteger(amountCents) || amountCents <= 0)) {
    return { error: 'Valid amount_cents is required' };
  }

  return {
    therapistId,
    date,
    time,
    sessionType,
    amountCents,
  };
};

const validateBookingSlotStillAvailable = async ({ therapistId, date, time }, queryClient = pool) => {
  const normalizedDate = toIsoDateOnly(date);
  const normalizedTime = toHHMM(time);
  const dayOfWeek = getDayOfWeek(normalizedDate);
  const requestedMinutes = toMinutes(normalizedTime);

  if (!normalizedDate || !normalizedTime || Number.isNaN(dayOfWeek) || Number.isNaN(requestedMinutes)) {
    const err = new Error('Invalid booking date or time');
    err.statusCode = 400;
    throw err;
  }

  const rulesResult = await queryClient.query(
    `SELECT start_time, end_time, slot_minutes
     FROM therapist_availability_rules
     WHERE therapist_id = $1 AND day_of_week = $2 AND is_active = true`,
    [therapistId, dayOfWeek]
  );

  const matchingRule = rulesResult.rows.find((rule) => {
    const slotMinutes = Number(rule.slot_minutes || 30);
    return requestedMinutes >= toMinutes(rule.start_time) && requestedMinutes + slotMinutes <= toMinutes(rule.end_time);
  });

  if (!matchingRule) {
    const err = new Error('Requested time is outside therapist availability');
    err.statusCode = 400;
    throw err;
  }

  const slotMinutes = Number(matchingRule.slot_minutes || 30);
  const blocked = await queryClient.query(
    `SELECT starts_at, ends_at
     FROM therapist_blocked_times
     WHERE therapist_id = $1
       AND starts_at < ($2::date + interval '1 day')
       AND ends_at > $2::date`,
    [therapistId, normalizedDate]
  );
  if (blocked.rows.some((block) => slotOverlapsBlock(normalizedDate, normalizedTime, slotMinutes, block))) {
    const err = new Error('Requested time is blocked by therapist');
    err.statusCode = 409;
    throw err;
  }
};

// Initialize Razorpay
const createRazorpayClient = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay credentials are not configured');
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
};

const auth = authenticateToken;

const verifyRazorpaySignature = ({ orderId, paymentId, signature }) => {
  if (!process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay credentials are not configured');
  }
  const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
  hmac.update(`${orderId}|${paymentId}`);
  const calculatedSignature = hmac.digest('hex');
  return (
    calculatedSignature.length === signature.length &&
    crypto.timingSafeEqual(Buffer.from(calculatedSignature), Buffer.from(signature))
  );
};

const resolveExpectedPaidAmountCents = async ({ therapistId, sessionType, clientAmountCents }) => {
  if (sessionType === 'intro') {
    const err = new Error('Intro sessions do not require payment');
    err.statusCode = 400;
    throw err;
  }

  const therapistRate = await pool.query(
    `SELECT id, status, rate_60min
     FROM therapists
     WHERE id = $1`,
    [therapistId]
  );

  if (!therapistRate.rows.length || therapistRate.rows[0].status !== 'approved') {
    const err = new Error('Therapist not found');
    err.statusCode = 404;
    throw err;
  }

  const expectedAmountCents = Math.round(Number(therapistRate.rows[0].rate_60min || 0) * 100);
  if (!Number.isInteger(expectedAmountCents) || expectedAmountCents <= 0) {
    const err = new Error('Therapist rate is not configured for payment');
    err.statusCode = 400;
    throw err;
  }

  if (clientAmountCents !== null && clientAmountCents !== expectedAmountCents) {
    const err = new Error('Invalid payment amount');
    err.statusCode = 400;
    throw err;
  }

  return expectedAmountCents;
};

const loadBookingEmailData = async ({ therapistId, userId }) => {
  const details = await pool.query(
    `SELECT u.full_name as client_name, u.email as client_email, t.full_name as therapist_name, t.email as therapist_email
     FROM users u
     JOIN therapists t ON t.id = $1
     WHERE u.id = $2`,
    [therapistId, userId]
  );
  return details.rows[0] || null;
};

const finalizeIntentBookingAndPayment = async ({ orderId, paymentId, expectedClientId = null }) => {
  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');

    const params = expectedClientId === null ? [orderId] : [orderId, expectedClientId];
    const intentResult = await dbClient.query(
      `SELECT id, order_id, client_id, therapist_id, booking_date, booking_time, session_type, amount_cents, status, booking_id, payment_id
       FROM payment_booking_intents
       WHERE order_id = $1 ${expectedClientId === null ? '' : 'AND client_id = $2'}
       FOR UPDATE`,
      params
    );

    if (!intentResult.rows.length) {
      await dbClient.query('ROLLBACK');
      return { status: 'intent_not_found' };
    }

    const intent = intentResult.rows[0];
    if (intent.status === 'completed' && intent.booking_id && intent.payment_id) {
      const [bookingResult, paymentResult] = await Promise.all([
        dbClient.query('SELECT * FROM bookings WHERE id = $1', [intent.booking_id]),
        dbClient.query('SELECT * FROM payments WHERE id = $1', [intent.payment_id]),
      ]);
      await dbClient.query('COMMIT');
      return {
        status: 'already_finalized',
        booking: bookingResult.rows[0] || null,
        payment: paymentResult.rows[0] || null,
        newlyFinalized: false,
      };
    }

    await validateBookingSlotStillAvailable(
      {
        therapistId: intent.therapist_id,
        date: toIsoDateOnly(intent.booking_date),
        time: toHHMM(intent.booking_time),
      },
      dbClient
    );

    const bookingResult = await dbClient.query(
      `INSERT INTO bookings (user_id, therapist_id, date, time, session_type, status, amount_cents)
       VALUES ($1, $2, $3, $4, $5, 'confirmed', $6)
       RETURNING *`,
      [
        intent.client_id,
        intent.therapist_id,
        intent.booking_date,
        intent.booking_time,
        intent.session_type || 'video',
        intent.amount_cents,
      ]
    );

    const existingPayment = await dbClient.query(
      `SELECT id
       FROM payments
       WHERE razorpay_payment_id = $1
       LIMIT 1
       FOR UPDATE`,
      [paymentId]
    );

    let paymentResult;
    if (existingPayment.rows.length) {
      paymentResult = await dbClient.query(
        `UPDATE payments
         SET booking_id = COALESCE(booking_id, $1),
             client_id = COALESCE(client_id, $2),
             therapist_id = COALESCE(therapist_id, $3),
             amount_cents = COALESCE(amount_cents, $4),
             status = 'completed',
             razorpay_order_id = COALESCE(razorpay_order_id, $5),
             completed_at = COALESCE(completed_at, NOW()),
             updated_at = NOW()
         WHERE id = $6
         RETURNING *`,
        [
          bookingResult.rows[0].id,
          intent.client_id,
          intent.therapist_id,
          intent.amount_cents,
          orderId,
          existingPayment.rows[0].id,
        ]
      );
    } else {
      paymentResult = await dbClient.query(
        `INSERT INTO payments
          (booking_id, client_id, therapist_id, amount_cents, status, razorpay_order_id, razorpay_payment_id, completed_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'completed', $5, $6, NOW(), NOW(), NOW())
         RETURNING *`,
        [
          bookingResult.rows[0].id,
          intent.client_id,
          intent.therapist_id,
          intent.amount_cents,
          orderId,
          paymentId,
        ]
      );
    }

    await dbClient.query(
      `UPDATE payment_booking_intents
       SET status = 'completed', booking_id = $1, payment_id = $2, updated_at = NOW()
       WHERE id = $3`,
      [bookingResult.rows[0].id, paymentResult.rows[0].id, intent.id]
    );

    await dbClient.query('COMMIT');

    const emailDataDetails = await loadBookingEmailData({
      therapistId: intent.therapist_id,
      userId: intent.client_id,
    });
    if (emailDataDetails) {
      dispatchBookingNotifications({
        bookingId: bookingResult.rows[0].id,
        clientName: emailDataDetails.client_name,
        clientEmail: emailDataDetails.client_email,
        therapistName: emailDataDetails.therapist_name,
        therapistEmail: emailDataDetails.therapist_email,
        date: bookingResult.rows[0].date,
        time: bookingResult.rows[0].time,
        sessionType: bookingResult.rows[0].session_type,
      });
    }

    syncBookingToConnectedCalendars(bookingResult.rows[0].id).catch((err) => {
      console.error('Calendar sync error:', err);
    });

    return {
      status: 'finalized',
      booking: bookingResult.rows[0],
      payment: paymentResult.rows[0],
      newlyFinalized: true,
    };
  } catch (err) {
    await dbClient.query('ROLLBACK').catch(() => {});
    if (err.code === '23505') {
      await pool.query(
        `UPDATE payment_booking_intents
         SET status = 'conflict', updated_at = NOW()
         WHERE order_id = $1`,
        [orderId]
      ).catch(() => {});
      return { status: 'slot_conflict' };
    }
    throw err;
  } finally {
    dbClient.release();
  }
};

/**
 * POST /api/payments/create-order
 * Create a Razorpay order.
 * Legacy body: { booking_id }
 * New body: { therapist_id, date, time, session_type, amount_cents }
 */
router.post('/create-order', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { booking_id } = req.body || {};
    const user_id = req.user.id;
    if (req.user.role !== 'client') {
      return res.status(403).json({ error: 'Client access required' });
    }

    // Legacy flow: booking exists already.
    if (booking_id) {
      const bookingResult = await pool.query(
        `SELECT b.*, t.rate_60min
         FROM bookings b
         JOIN therapists t ON t.id = b.therapist_id
         WHERE b.id = $1 AND b.user_id = $2`,
        [booking_id, user_id]
      );

      if (bookingResult.rows.length === 0) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      const booking = bookingResult.rows[0];
      const amountInPaise = Number(booking.amount_paise || booking.amount_cents || booking.rate_60min * 100);
      if (!Number.isInteger(amountInPaise) || amountInPaise <= 0) {
        return res.status(400).json({ error: 'Unable to determine booking amount' });
      }

      const razorpayOrder = await createRazorpayClient().orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: `booking_${booking_id}_${Date.now()}`,
        notes: { booking_id, user_id }
      });

      const payment = await pool.query(
        `INSERT INTO payments (client_id, therapist_id, booking_id, amount_cents, status, razorpay_order_id, created_at)
         VALUES ($1, $2, $3, $4, 'pending', $5, NOW())
         RETURNING id`,
        [user_id, booking.therapist_id, booking_id, amountInPaise, razorpayOrder.id]
      );

      return res.status(201).json({
        order_id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        payment_id: payment.rows[0].id,
        key_id: process.env.RAZORPAY_KEY_ID
      });
    }

    // New paid-flow: booking will be created only after successful payment verification.
    const parsed = validatePaidIntentPayload(req.body || {});
    if (parsed.error) {
      return res.status(400).json({ error: parsed.error });
    }

    const expectedAmountCents = await resolveExpectedPaidAmountCents({
      therapistId: parsed.therapistId,
      sessionType: parsed.sessionType,
      clientAmountCents: parsed.amountCents,
    });

    const razorpayOrder = await createRazorpayClient().orders.create({
      amount: expectedAmountCents,
      currency: 'INR',
      receipt: `paid_slot_${parsed.therapistId}_${Date.now()}`,
      notes: {
        user_id,
        therapist_id: parsed.therapistId,
        date: parsed.date,
        time: parsed.time,
        session_type: parsed.sessionType,
      }
    });

    await client.query('BEGIN');
    await client.query(
      `INSERT INTO payment_booking_intents
        (order_id, client_id, therapist_id, booking_date, booking_time, session_type, amount_cents, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'initiated', NOW(), NOW())
       ON CONFLICT (order_id)
       DO UPDATE SET client_id = EXCLUDED.client_id,
                     therapist_id = EXCLUDED.therapist_id,
                     booking_date = EXCLUDED.booking_date,
                     booking_time = EXCLUDED.booking_time,
                     session_type = EXCLUDED.session_type,
                     amount_cents = EXCLUDED.amount_cents,
                     status = 'initiated',
                     updated_at = NOW()`,
      [razorpayOrder.id, user_id, parsed.therapistId, parsed.date, parsed.time, parsed.sessionType, expectedAmountCents]
    );
    await client.query('COMMIT');

    res.status(201).json({
      order_id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key_id: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error creating Razorpay order:', err);
    res.status(500).json({ error: 'Failed to create payment order' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/payments/verify-and-finalize-booking
 * Body: { razorpay_payment_id, razorpay_order_id, razorpay_signature }
 */
router.post('/verify-and-finalize-booking', auth, async (req, res) => {
  try {
    if (req.user.role !== 'client') {
      return res.status(403).json({ error: 'Client access required' });
    }

    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body || {};
    const user_id = req.user.id;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Payment details are required' });
    }

    if (!verifyRazorpaySignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    })) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    const finalizeResult = await finalizeIntentBookingAndPayment({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      expectedClientId: user_id,
    });
    if (finalizeResult.status === 'intent_not_found') {
      return res.status(404).json({ error: 'Payment booking intent not found' });
    }
    if (finalizeResult.status === 'slot_conflict') {
      return res.status(409).json({ error: 'This time slot was just booked. Please choose another time.' });
    }

    res.json({
      success: true,
      booking: finalizeResult.booking,
      payment: finalizeResult.payment,
    });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ error: err.message || 'Failed to finalize paid booking' });
  }
});

/**
 * POST /api/payments/verify
 * Verify Razorpay payment and update booking status (legacy endpoint)
 * Body: { razorpay_payment_id, razorpay_order_id, razorpay_signature, booking_id }
 */
router.post('/verify', auth, async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, booking_id } = req.body;
    const user_id = req.user.id;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Payment details are required' });
    }
    if (!verifyRazorpaySignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    })) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    const paymentResult = await pool.query(
      `UPDATE payments
       SET status = 'completed', razorpay_payment_id = $1, completed_at = NOW(), updated_at = NOW()
       WHERE razorpay_order_id = $2 AND client_id = $3
       RETURNING *`,
      [razorpay_payment_id, razorpay_order_id, user_id]
    );

    if (paymentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Payment record not found' });
    }

    if (booking_id) {
      await pool.query(
        'UPDATE bookings SET status = $1 WHERE id = $2 AND user_id = $3',
        ['confirmed', booking_id, user_id]
      );
    }

    res.json({
      success: true,
      message: 'Payment verified successfully',
      payment: paymentResult.rows[0]
    });
  } catch (err) {
    console.error('Error verifying payment:', err);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

/**
 * GET /api/payments/status/:payment_id
 * Get payment status
 */
router.get('/status/:payment_id', auth, async (req, res) => {
  try {
    const { payment_id } = req.params;
    const user_id = req.user.id;

    const payment = await pool.query(
      'SELECT id, status, amount_cents, created_at, completed_at FROM payments WHERE id = $1 AND client_id = $2',
      [payment_id, user_id]
    );

    if (payment.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    res.json({ payment: payment.rows[0] });
  } catch (err) {
    console.error('Error fetching payment status:', err);
    res.status(500).json({ error: 'Failed to fetch payment status' });
  }
});

/**
 * POST /api/payments/webhook
 * Razorpay webhook for payment events
 */
router.post('/webhook', async (req, res) => {
  try {
    const eventIdHeader = String(req.headers['x-razorpay-event-id'] || '').trim();
    const signature = req.headers['x-razorpay-signature'];
    const body = req.rawBody;
    if (!process.env.RAZORPAY_WEBHOOK_SECRET || !body || !signature || !eventIdHeader) {
      return res.status(400).json({ error: 'Webhook verification is not configured' });
    }

    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET);
    hmac.update(body);
    const calculatedSignature = hmac.digest('hex');

    const validWebhookSignature =
      calculatedSignature.length === signature.length &&
      crypto.timingSafeEqual(Buffer.from(calculatedSignature), Buffer.from(signature));

    if (!validWebhookSignature) {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    const event = req.body;
    const eventInsert = await pool.query(
      `INSERT INTO razorpay_webhook_events (event_id, event_type, payload, received_at)
       VALUES ($1, $2, $3::jsonb, NOW())
       ON CONFLICT (event_id) DO NOTHING
       RETURNING event_id`,
      [eventIdHeader, event.event || 'unknown', JSON.stringify(event || {})]
    );
    if (!eventInsert.rows.length) {
      return res.json({ received: true, duplicate: true });
    }

    if (event.event === 'payment.captured') {
      const paymentEntity = event.payload?.payment?.entity;
      const orderId = paymentEntity?.order_id;
      const paymentId = paymentEntity?.id;
      if (!orderId || !paymentId) {
        return res.status(400).json({ error: 'Invalid payment.captured payload' });
      }

      const finalizeResult = await finalizeIntentBookingAndPayment({
        orderId,
        paymentId,
      });
      if (finalizeResult.status === 'intent_not_found') {
        await pool.query(
          `UPDATE payments
           SET status = 'completed', completed_at = NOW(), updated_at = NOW(), razorpay_payment_id = COALESCE(razorpay_payment_id, $2)
           WHERE razorpay_order_id = $1`,
          [orderId, paymentId]
        );
      }
    }
    if (event.event === 'payment.failed') {
      const orderId = event.payload?.payment?.entity?.order_id;
      if (!orderId) {
        return res.status(400).json({ error: 'Invalid payment.failed payload' });
      }
      await pool.query(
        `UPDATE payments
         SET status = 'failed', updated_at = NOW()
         WHERE razorpay_order_id = $1 AND status != 'completed'`,
        [orderId]
      );
      await pool.query(
        `UPDATE payment_booking_intents
         SET status = 'failed', updated_at = NOW()
         WHERE order_id = $1 AND status NOT IN ('completed', 'conflict')`,
        [orderId]
      );
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Error handling Razorpay webhook:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * GET /api/payments/my-payments
 * Get payment history for logged-in user
 */
router.get('/my-payments', auth, async (req, res) => {
  try {
    const user_id = req.user.id;

    const result = await pool.query(
      `SELECT
        p.id,
        p.booking_id,
        p.amount_cents,
        p.status,
        p.razorpay_order_id,
        p.razorpay_payment_id,
        p.created_at,
        p.completed_at
      FROM payments p
      WHERE p.client_id = $1
      ORDER BY p.created_at DESC`,
      [user_id]
    );

    return res.json({ payments: result.rows });
  } catch (err) {
    console.error('Get payments error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/payments/therapist/my-payments
 * Get DB-backed payment history and earnings summary for logged-in therapist
 */
router.get('/therapist/my-payments', auth, async (req, res) => {
  try {
    if (req.user.role !== 'therapist') {
      return res.status(403).json({ error: 'Therapist access required' });
    }

    const result = await pool.query(
      `SELECT
        p.id,
        p.booking_id,
        p.amount_cents,
        p.status,
        p.razorpay_order_id,
        p.razorpay_payment_id,
        p.created_at,
        p.completed_at,
        u.id as client_id,
        u.full_name as client_name,
        u.email as client_email,
        b.date as booking_date,
        b.time as booking_time,
        b.session_type
       FROM payments p
       JOIN users u ON u.id = p.client_id
       LEFT JOIN bookings b ON b.id = p.booking_id
       WHERE p.therapist_id = $1
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );

    const summary = result.rows.reduce((acc, payment) => {
      const amount = Number(payment.amount_cents || 0);
      const completedDate = payment.completed_at ? new Date(payment.completed_at) : null;
      const now = new Date();
      if (payment.status === 'completed') {
        acc.totalEarningsCents += amount;
        if (completedDate && completedDate.getMonth() === now.getMonth() && completedDate.getFullYear() === now.getFullYear()) {
          acc.monthlyEarningsCents += amount;
        }
      }
      if (payment.status === 'pending') acc.pendingPayments += 1;
      return acc;
    }, { totalEarningsCents: 0, monthlyEarningsCents: 0, pendingPayments: 0 });

    return res.json({ payments: result.rows, summary });
  } catch (err) {
    console.error('Get therapist payments error:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
