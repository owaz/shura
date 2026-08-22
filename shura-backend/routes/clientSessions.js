const express = require('express');
const rateLimit = require('express-rate-limit');
const pool = require('../db');
const { errorResponse, parsePagination, paginatedResponse } = require('../utils/apiResponse');
const { getImageReadUrl } = require('../services/azureBlobStorage');
const {
  getVideoProvider,
  isLegacyClientSessionJoinEnabled,
  VideoProviderNotConfiguredError,
} = require('../services/video/videoProvider');
const { refundPayment } = require('../services/razorpayRefunds');
const { createClientNotification } = require('../services/clientNotifications');
const {
  normalizePolicies,
  normalizeSessionStatus,
  sessionActions,
  validateCancellationReason,
  validateReview,
} = require('../utils/clientSessionPolicy');
const {
  sendSessionCancellationNotifications,
  sendSessionRescheduledNotifications,
} = require('../utils/emailService');
const {
  cancelBookingOnConnectedCalendars,
  syncBookingUpdateToConnectedCalendars,
} = require('../utils/calendarIntegrations');

const router = express.Router();

const sessionMutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

const sessionSelect = `
  SELECT b.id, b.user_id, b.therapist_id, b.scheduled_at, b.duration_minutes,
         b.session_type, b.status, b.cancelled_at, b.cancellation_reason,
         b.cancelled_by, b.rescheduled_at, b.rescheduled_from, b.video_room_id,
         b.created_at, b.updated_at,
         t.full_name AS therapist_name, t.credentials AS therapist_credentials,
         t.profile_image_url AS therapist_image_url,
         t.profile_image_blob_name AS therapist_image_blob_name,
         t.profile_image_storage_provider AS therapist_image_storage_provider,
         u.timezone AS client_timezone, u.full_name AS client_name, u.email AS client_email,
         review.id AS review_id, review.rating AS review_rating,
         payment.id AS payment_id, payment.amount_cents, payment.currency,
         payment.status AS payment_status, payment.razorpay_payment_id,
         payment.refund_amount_cents, payment.refund_status, payment.razorpay_refund_id
  FROM bookings b
  JOIN therapists t ON t.id = b.therapist_id
  JOIN users u ON u.id = b.user_id
  LEFT JOIN client_session_reviews review ON review.booking_id = b.id
  LEFT JOIN LATERAL (
    SELECT p.id, p.amount_cents, p.currency, p.status, p.razorpay_payment_id,
           p.refund_amount_cents, p.refund_status, p.razorpay_refund_id
    FROM payments p
    WHERE p.booking_id = b.id AND p.client_id = b.user_id
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT 1
  ) payment ON TRUE`;

const paidStatuses = new Set(['completed', 'success', 'paid', 'refunded']);

const loadPolicies = async (queryable = pool) => {
  const { rows } = await queryable.query(
    `SELECT setting_value FROM platform_settings WHERE setting_key = 'session_policies'`
  );
  return normalizePolicies(rows[0]?.setting_value || {});
};

const therapistImageUrl = async (row) => {
  if (row.therapist_image_storage_provider === 'azure_blob' && row.therapist_image_blob_name) {
    return getImageReadUrl(row.therapist_image_blob_name);
  }
  return row.therapist_image_url || '';
};

const sessionDto = async (row, policies, now = new Date()) => {
  const status = normalizeSessionStatus(row.status);
  const paid = paidStatuses.has(String(row.payment_status || '').toLowerCase());
  const actions = sessionActions({
    scheduledAt: row.scheduled_at,
    durationMinutes: row.duration_minutes,
    sessionType: row.session_type,
    status,
    paid,
  }, policies, now);
  const credentials = Array.isArray(row.therapist_credentials)
    ? row.therapist_credentials.filter(Boolean)
    : String(row.therapist_credentials || '').split(',').map((value) => value.trim()).filter(Boolean);

  return {
    id: row.id,
    therapist: {
      id: row.therapist_id,
      name: row.therapist_name,
      credentials,
      imageUrl: await therapistImageUrl(row),
    },
    scheduledAt: row.scheduled_at,
    clientTimezone: row.client_timezone || 'UTC',
    durationMinutes: Number(row.duration_minutes || 50),
    sessionType: String(row.session_type || 'video').toLowerCase(),
    status,
    cancelledAt: row.cancelled_at,
    cancellationReason: row.cancellation_reason,
    cancelledBy: row.cancelled_by,
    rescheduledAt: row.rescheduled_at,
    rescheduledFrom: row.rescheduled_from,
    reviewed: Boolean(row.review_id),
    reviewRating: row.review_rating ? Number(row.review_rating) : null,
    reviewEligible: status === 'completed' && !row.review_id,
    receipt: row.payment_id && paid ? {
      id: row.payment_id,
      amountCents: Number(row.amount_cents || 0),
      currency: row.currency || 'INR',
      status: row.refund_status === 'completed' ? 'refunded' : row.payment_status,
      paymentReference: row.razorpay_payment_id || null,
      refundAmountCents: Number(row.refund_amount_cents || 0),
      refundReference: row.razorpay_refund_id || null,
    } : null,
    actions,
  };
};

const fetchSession = async (clientId, sessionId, queryable = pool) => {
  const { rows } = await queryable.query(
    `${sessionSelect} WHERE b.id = $1 AND b.user_id = $2`,
    [sessionId, clientId]
  );
  return rows[0] || null;
};

const validSessionId = (value) => Number.isInteger(Number(value)) && Number(value) > 0;

const parseDateRange = (query) => {
  const from = String(query.from || '');
  const to = String(query.to || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null;
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  if (Number.isNaN(days) || days < 0 || days > 31) return null;
  return { from, to };
};

router.get('/', async (req, res) => {
  const status = String(req.query.status || 'upcoming').toLowerCase();
  if (!['upcoming', 'past', 'cancelled'].includes(status)) {
    return errorResponse(res, 400, 'INVALID_SESSION_FILTER', 'Choose upcoming, past, or cancelled sessions.');
  }
  const pagination = parsePagination(req.query);
  const filters = {
    upcoming: `LOWER(COALESCE(b.status, 'pending')) IN ('pending', 'confirmed', 'upcoming', 'live')
               AND b.scheduled_at + make_interval(mins => COALESCE(b.duration_minutes, 50)) >= NOW()`,
    past: `LOWER(COALESCE(b.status, '')) IN ('completed', 'no_show_client', 'no_show_therapist', 'no-show')`,
    cancelled: `LOWER(COALESCE(b.status, '')) = 'cancelled'`,
  };
  const order = status === 'upcoming' ? 'b.scheduled_at ASC' : 'COALESCE(b.cancelled_at, b.scheduled_at) DESC';
  try {
    const policies = await loadPolicies();
    const [result, count] = await Promise.all([
      pool.query(
        `${sessionSelect}
         WHERE b.user_id = $1 AND b.scheduled_at IS NOT NULL AND ${filters[status]}
         ORDER BY ${order}
         LIMIT $2 OFFSET $3`,
        [req.clientId, pagination.limit, pagination.offset]
      ),
      pool.query(
        `SELECT COUNT(*)::integer AS total FROM bookings b
         WHERE b.user_id = $1 AND b.scheduled_at IS NOT NULL AND ${filters[status]}`,
        [req.clientId]
      ),
    ]);
    const sessions = await Promise.all(result.rows.map((row) => sessionDto(row, policies)));
    return paginatedResponse(res, sessions, {
      ...pagination,
      total: Number(count.rows[0]?.total || 0),
    });
  } catch (err) {
    console.error('GET /api/client/sessions error', { code: err?.code || 'SESSIONS_LOAD_FAILED' });
    return errorResponse(res, 500, 'SESSIONS_LOAD_FAILED', 'We could not load your sessions right now.');
  }
});

router.get('/:id/availability', async (req, res) => {
  if (!validSessionId(req.params.id)) return errorResponse(res, 400, 'INVALID_SESSION_ID', 'Choose a valid session.');
  const range = parseDateRange(req.query);
  if (!range) return errorResponse(res, 400, 'INVALID_DATE_RANGE', 'Choose a date range of up to 31 days.');
  try {
    const session = await fetchSession(req.clientId, req.params.id);
    if (!session) return errorResponse(res, 404, 'SESSION_NOT_FOUND', 'This session could not be found.');
    const policies = await loadPolicies();
    const actions = sessionActions({
      scheduledAt: session.scheduled_at,
      durationMinutes: session.duration_minutes,
      sessionType: session.session_type,
      status: session.status,
    }, policies);
    if (!actions.canReschedule) {
      return errorResponse(res, 409, 'RESCHEDULE_WINDOW_CLOSED', `Sessions cannot be rescheduled within ${policies.rescheduleCutoffHours} hours of the start time.`);
    }
    const { rows } = await pool.query(
      `WITH days AS (
         SELECT day::date
         FROM generate_series(($2::date - 1), ($3::date + 1), interval '1 day') AS day
       ), candidates AS (
         SELECT slot AS scheduled_at
         FROM days
         JOIN therapist_availability_rules rule
           ON rule.therapist_id = $1
          AND rule.is_active = TRUE
          AND rule.day_of_week = EXTRACT(DOW FROM days.day)::integer
         CROSS JOIN LATERAL generate_series(
           (days.day + rule.start_time) AT TIME ZONE rule.timezone,
           ((days.day + rule.end_time) AT TIME ZONE rule.timezone) - make_interval(mins => $5),
           make_interval(mins => rule.slot_minutes)
         ) AS slot
       )
       SELECT candidate.scheduled_at
       FROM candidates candidate
       WHERE (candidate.scheduled_at AT TIME ZONE $4)::date BETWEEN $2::date AND $3::date
         AND candidate.scheduled_at > NOW()
         AND NOT EXISTS (
           SELECT 1 FROM therapist_blocked_times blocked
           WHERE blocked.therapist_id = $1
             AND blocked.starts_at < candidate.scheduled_at + make_interval(mins => $5)
             AND blocked.ends_at > candidate.scheduled_at
         )
         AND NOT EXISTS (
           SELECT 1 FROM bookings existing
           WHERE existing.therapist_id = $1
             AND existing.id <> $6
             AND LOWER(COALESCE(existing.status, '')) <> 'cancelled'
             AND existing.scheduled_at < candidate.scheduled_at + make_interval(mins => $5)
             AND existing.scheduled_at + make_interval(mins => COALESCE(existing.duration_minutes, 50)) > candidate.scheduled_at
         )
       ORDER BY candidate.scheduled_at ASC
       LIMIT 300`,
      [session.therapist_id, range.from, range.to, session.client_timezone || 'UTC', Number(session.duration_minutes || 50), session.id]
    );
    return res.json({
      data: {
        timezone: session.client_timezone || 'UTC',
        slots: rows.map((row) => ({ scheduledAt: row.scheduled_at })),
      },
    });
  } catch (err) {
    console.error('GET session availability error', { code: err?.code || 'SESSION_AVAILABILITY_FAILED' });
    return errorResponse(res, 500, 'AVAILABILITY_LOAD_FAILED', 'We could not load available times.');
  }
});

router.get('/:id', async (req, res) => {
  if (!validSessionId(req.params.id)) return errorResponse(res, 400, 'INVALID_SESSION_ID', 'Choose a valid session.');
  try {
    const [row, policies] = await Promise.all([fetchSession(req.clientId, req.params.id), loadPolicies()]);
    if (!row) return errorResponse(res, 404, 'SESSION_NOT_FOUND', 'This session could not be found.');
    return res.json({ data: { session: await sessionDto(row, policies) } });
  } catch (err) {
    console.error('GET client session error', { code: err?.code || 'SESSION_LOAD_FAILED' });
    return errorResponse(res, 500, 'SESSION_LOAD_FAILED', 'We could not load this session.');
  }
});

const assertAvailableSlot = async (client, booking, scheduledAt) => {
  const duration = Number(booking.duration_minutes || 50);
  const rules = await client.query(
    `SELECT timezone
     FROM therapist_availability_rules rule
     WHERE rule.therapist_id = $1 AND rule.is_active = TRUE
       AND rule.day_of_week = EXTRACT(DOW FROM ($2::timestamptz AT TIME ZONE rule.timezone))::integer
       AND ($2::timestamptz AT TIME ZONE rule.timezone)::time >= rule.start_time
       AND (($2::timestamptz + make_interval(mins => $3)) AT TIME ZONE rule.timezone)::time <= rule.end_time
     ORDER BY rule.id ASC LIMIT 1`,
    [booking.therapist_id, scheduledAt, duration]
  );
  if (!rules.rows.length) {
    const error = new Error('The selected time is outside your therapist’s availability.');
    error.code = 'SLOT_OUTSIDE_AVAILABILITY';
    throw error;
  }
  const conflicts = await client.query(
    `SELECT EXISTS (
       SELECT 1 FROM therapist_blocked_times blocked
       WHERE blocked.therapist_id = $1
         AND blocked.starts_at < $2::timestamptz + make_interval(mins => $3)
         AND blocked.ends_at > $2::timestamptz
     ) OR EXISTS (
       SELECT 1 FROM bookings existing
       WHERE existing.therapist_id = $1 AND existing.id <> $4
         AND LOWER(COALESCE(existing.status, '')) <> 'cancelled'
         AND existing.scheduled_at < $2::timestamptz + make_interval(mins => $3)
         AND existing.scheduled_at + make_interval(mins => COALESCE(existing.duration_minutes, 50)) > $2::timestamptz
     ) AS unavailable`,
    [booking.therapist_id, scheduledAt, duration, booking.id]
  );
  if (conflicts.rows[0]?.unavailable) {
    const error = new Error('That time was just taken. Please choose another available time.');
    error.code = 'SLOT_CONFLICT';
    throw error;
  }
  return rules.rows[0].timezone;
};

router.patch('/:id/reschedule', sessionMutationLimiter, async (req, res) => {
  if (!validSessionId(req.params.id)) return errorResponse(res, 400, 'INVALID_SESSION_ID', 'Choose a valid session.');
  const nextDate = new Date(req.body?.scheduledAt);
  if (!req.body?.scheduledAt || Number.isNaN(nextDate.getTime()) || nextDate <= new Date()) {
    return errorResponse(res, 400, 'INVALID_SESSION_TIME', 'Choose a valid future session time.');
  }
  const client = await pool.connect();
  let updatedId;
  try {
    await client.query('BEGIN');
    const policies = await loadPolicies(client);
    const { rows } = await client.query(
      `SELECT b.*, u.full_name AS client_name, u.email AS client_email, u.timezone AS client_timezone,
              t.full_name AS therapist_name, t.email AS therapist_email
       FROM bookings b
       JOIN users u ON u.id = b.user_id
       JOIN therapists t ON t.id = b.therapist_id
       WHERE b.id = $1 AND b.user_id = $2
       FOR UPDATE OF b`,
      [req.params.id, req.clientId]
    );
    const booking = rows[0];
    if (!booking) {
      await client.query('ROLLBACK');
      return errorResponse(res, 404, 'SESSION_NOT_FOUND', 'This session could not be found.');
    }
    const actions = sessionActions({
      scheduledAt: booking.scheduled_at,
      durationMinutes: booking.duration_minutes,
      sessionType: booking.session_type,
      status: booking.status,
    }, policies);
    if (!actions.canReschedule) {
      await client.query('ROLLBACK');
      return errorResponse(res, 409, 'RESCHEDULE_WINDOW_CLOSED', `Sessions cannot be rescheduled within ${policies.rescheduleCutoffHours} hours of the start time.`);
    }
    await client.query('SELECT pg_advisory_xact_lock($1, hashtext($2))', [booking.therapist_id, nextDate.toISOString().slice(0, 10)]);
    const therapistTimezone = await assertAvailableSlot(client, booking, nextDate.toISOString());
    const previousScheduledAt = booking.scheduled_at;
    await client.query(
      `UPDATE bookings
       SET scheduled_at = $1,
           date = ($1::timestamptz AT TIME ZONE $2)::date,
           time = TO_CHAR($1::timestamptz AT TIME ZONE $2, 'HH24:MI'),
           rescheduled_from = scheduled_at,
           rescheduled_at = NOW(),
           status = CASE WHEN LOWER(COALESCE(status, '')) = 'pending' THEN status ELSE 'confirmed' END,
           updated_at = NOW()
       WHERE id = $3`,
      [nextDate.toISOString(), therapistTimezone, booking.id]
    );
    const eventResult = await client.query(
      `INSERT INTO client_session_events
        (booking_id, client_id, event_type, previous_scheduled_at, next_scheduled_at)
       VALUES ($1, $2, 'rescheduled', $3, $4)
       RETURNING id`,
      [booking.id, req.clientId, previousScheduledAt, nextDate.toISOString()]
    );
    await client.query(
      `INSERT INTO notifications (client_id, type, title, body, metadata)
       VALUES ($1, 'session_rescheduled', 'Session rescheduled',
               'Your session has been moved to a new time.', $2::jsonb)`,
      [req.clientId, JSON.stringify({ bookingId: booking.id, previousScheduledAt, nextScheduledAt: nextDate.toISOString() })]
    );
    const emailResult = await sendSessionRescheduledNotifications(
      { ...booking, previousScheduledAt, nextScheduledAt: nextDate.toISOString() },
      eventResult.rows[0].id,
      client
    );
    if (!emailResult.success) throw new Error(emailResult.error || 'Reschedule email could not be queued');
    await client.query('COMMIT');
    updatedId = booking.id;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Reschedule session error', { code: err?.code || 'RESCHEDULE_FAILED' });
    const status = err.code === 'SLOT_CONFLICT' ? 409 : err.code === 'SLOT_OUTSIDE_AVAILABILITY' ? 400 : 500;
    return errorResponse(res, status, err.code || 'RESCHEDULE_FAILED', status === 500 ? 'We could not reschedule this session.' : err.message);
  } finally {
    client.release();
  }

  void Promise.allSettled([
    syncBookingUpdateToConnectedCalendars(updatedId),
  ]).then((results) => results.filter((result) => result.status === 'rejected')
    .forEach((result) => console.error('Post-reschedule notification error', { code: result.reason?.code || 'NOTIFICATION_FAILED' })));
  const [row, policies] = await Promise.all([fetchSession(req.clientId, updatedId), loadPolicies()]);
  return res.json({ data: { session: await sessionDto(row, policies) } });
});

router.post('/:id/cancel', sessionMutationLimiter, async (req, res) => {
  if (!validSessionId(req.params.id)) return errorResponse(res, 400, 'INVALID_SESSION_ID', 'Choose a valid session.');
  const reasonResult = validateCancellationReason(req.body?.reason);
  if (reasonResult.error) return errorResponse(res, 400, 'INVALID_CANCELLATION_REASON', reasonResult.error);
  const client = await pool.connect();
  let booking;
  let payment;
  let refundEligible = false;
  let alreadyCancelled = false;
  try {
    await client.query('BEGIN');
    const policies = await loadPolicies(client);
    const { rows } = await client.query(
      `SELECT b.*, u.full_name AS client_name, u.email AS client_email, u.timezone AS client_timezone,
              t.full_name AS therapist_name, t.email AS therapist_email
       FROM bookings b
       JOIN users u ON u.id = b.user_id
       JOIN therapists t ON t.id = b.therapist_id
       WHERE b.id = $1 AND b.user_id = $2
       FOR UPDATE OF b`,
      [req.params.id, req.clientId]
    );
    booking = rows[0];
    if (!booking) {
      await client.query('ROLLBACK');
      return errorResponse(res, 404, 'SESSION_NOT_FOUND', 'This session could not be found.');
    }
    alreadyCancelled = normalizeSessionStatus(booking.status) === 'cancelled';
    const paymentResult = await client.query(
      `SELECT * FROM payments WHERE booking_id = $1 AND client_id = $2
       ORDER BY created_at DESC, id DESC LIMIT 1 FOR UPDATE`,
      [booking.id, req.clientId]
    );
    payment = paymentResult.rows[0] || null;
    if (!alreadyCancelled) {
      const actions = sessionActions({
        scheduledAt: booking.scheduled_at,
        durationMinutes: booking.duration_minutes,
        sessionType: booking.session_type,
        status: booking.status,
        paid: payment && paidStatuses.has(String(payment.status || '').toLowerCase()),
      }, policies);
      if (!actions.canCancel) {
        await client.query('ROLLBACK');
        return errorResponse(res, 409, 'SESSION_NOT_CANCELLABLE', 'This session can no longer be cancelled.');
      }
      refundEligible = actions.refundEligible && Boolean(payment?.razorpay_payment_id);
      await client.query(
        `UPDATE bookings SET status = 'cancelled', cancelled_at = NOW(),
           cancellation_reason = $1, cancelled_by = 'client', updated_at = NOW()
         WHERE id = $2`,
        [reasonResult.value, booking.id]
      );
      await client.query(
        `INSERT INTO client_session_events (booking_id, client_id, event_type, metadata)
         VALUES ($1, $2, 'cancelled', $3::jsonb)`,
        [booking.id, req.clientId, JSON.stringify({ reasonProvided: Boolean(reasonResult.value), refundEligible })]
      );
      await client.query(
        `INSERT INTO notifications (client_id, type, title, body, metadata)
         VALUES ($1, 'session_cancelled', 'Session cancelled',
                 $2, $3::jsonb)`,
        [
          req.clientId,
          refundEligible ? 'Your session was cancelled and your refund is being processed.' : 'Your session was cancelled.',
          JSON.stringify({ bookingId: booking.id, refundEligible }),
        ]
      );
      const emailResult = await sendSessionCancellationNotifications({
        ...booking,
        refundEligible,
        refundStatus: refundEligible ? 'pending' : null,
      }, client);
      if (!emailResult.success) throw new Error(emailResult.error || 'Cancellation email could not be queued');
    } else {
      const retryableRefundStatus = new Set(['pending', 'failed']);
      refundEligible = Boolean(payment?.razorpay_payment_id)
        && retryableRefundStatus.has(String(payment?.refund_status || '').toLowerCase());
    }
    if (refundEligible && payment.refund_status !== 'completed') {
      await client.query(
        `UPDATE payments SET refund_status = 'pending', refund_amount_cents = amount_cents,
         refund_failure_reason = NULL, updated_at = NOW() WHERE id = $1`,
        [payment.id]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Cancel session error', { code: err?.code || 'CANCELLATION_FAILED' });
    return errorResponse(res, 500, 'CANCELLATION_FAILED', 'We could not cancel this session.');
  } finally {
    client.release();
  }

  let refundStatus = payment?.refund_status || null;
  if (refundEligible && payment?.refund_status !== 'completed') {
    try {
      const refund = await refundPayment({
        paymentId: payment.razorpay_payment_id,
        amountCents: Number(payment.amount_cents),
        bookingId: booking.id,
      });
      refundStatus = refund.status === 'processed' ? 'completed' : 'pending';
      await pool.query(
        `UPDATE payments SET status = CASE WHEN $1 = 'completed' THEN 'refunded' ELSE status END,
         refund_status = $1, razorpay_refund_id = $2,
         refunded_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE refunded_at END,
         updated_at = NOW()
         WHERE id = $3`,
        [refundStatus, refund.id, payment.id]
      );
      await createClientNotification(pool, {
        clientId: req.clientId,
        type: refundStatus === 'completed' ? 'refund_processed' : 'refund_pending',
        title: refundStatus === 'completed' ? 'Refund completed' : 'Refund processing',
        body: refundStatus === 'completed'
          ? 'Your session refund has been completed.'
          : 'Your refund request is still being processed.',
        metadata: { bookingId: booking.id },
        dedupeKey: `refund-booking:${booking.id}:${refundStatus}`,
      }).catch((notificationError) => {
        console.error('Refund notification insert failed', { code: notificationError?.code || 'NOTIFICATION_FAILED' });
      });
    } catch (err) {
      refundStatus = 'failed';
      console.error('Razorpay cancellation refund error', { code: err?.code || 'REFUND_FAILED' });
      await pool.query(
        `UPDATE payments SET refund_status = 'failed', refund_failure_reason = $1, updated_at = NOW()
         WHERE id = $2`,
        [String(err.message || 'Refund request failed').slice(0, 1000), payment.id]
      );
      await createClientNotification(pool, {
        clientId: req.clientId,
        type: 'refund_failed',
        title: 'Refund needs attention',
        body: 'Your refund could not be completed automatically. Shura support will need to review it.',
        metadata: { bookingId: booking.id },
        dedupeKey: `refund-booking:${booking.id}:failed`,
      }).catch((notificationError) => {
        console.error('Refund notification insert failed', { code: notificationError?.code || 'NOTIFICATION_FAILED' });
      });
    }
  }
  if (!alreadyCancelled) {
    void Promise.allSettled([
      cancelBookingOnConnectedCalendars(booking.id),
    ]).then((results) => results.filter((result) => result.status === 'rejected')
      .forEach((result) => console.error('Post-cancellation notification error', { code: result.reason?.code || 'NOTIFICATION_FAILED' })));
  }
  const [row, policies] = await Promise.all([fetchSession(req.clientId, booking.id), loadPolicies()]);
  return res.json({ data: { session: await sessionDto(row, policies), refundStatus } });
});

router.post('/:id/review', sessionMutationLimiter, async (req, res) => {
  if (!validSessionId(req.params.id)) return errorResponse(res, 400, 'INVALID_SESSION_ID', 'Choose a valid session.');
  const { errors, values } = validateReview(req.body);
  if (Object.keys(errors).length) return errorResponse(res, 400, 'VALIDATION_FAILED', 'Please review your rating.', errors);
  try {
    const booking = await pool.query(
      `SELECT id, therapist_id, status FROM bookings WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.clientId]
    );
    const row = booking.rows[0];
    if (!row) return errorResponse(res, 404, 'SESSION_NOT_FOUND', 'This session could not be found.');
    if (normalizeSessionStatus(row.status) !== 'completed') {
      return errorResponse(res, 409, 'REVIEW_NOT_AVAILABLE', 'Reviews are available after a completed session.');
    }
    const result = await pool.query(
      `INSERT INTO client_session_reviews (booking_id, client_id, therapist_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, rating, comment, created_at`,
      [row.id, req.clientId, row.therapist_id, values.rating, values.comment]
    );
    return res.status(201).json({ data: { review: result.rows[0] } });
  } catch (err) {
    if (err.code === '23505') return errorResponse(res, 409, 'REVIEW_ALREADY_SUBMITTED', 'You have already reviewed this session.');
    console.error('Submit review error', { code: err?.code || 'REVIEW_FAILED' });
    return errorResponse(res, 500, 'REVIEW_FAILED', 'We could not save your review.');
  }
});

router.post('/:id/join', sessionMutationLimiter, async (req, res) => {
  if (!validSessionId(req.params.id)) return errorResponse(res, 400, 'INVALID_SESSION_ID', 'Choose a valid session.');
  try {
    const [row, policies] = await Promise.all([fetchSession(req.clientId, req.params.id), loadPolicies()]);
    if (!row) return errorResponse(res, 404, 'SESSION_NOT_FOUND', 'This session could not be found.');
    const actions = sessionActions({
      scheduledAt: row.scheduled_at,
      durationMinutes: row.duration_minutes,
      sessionType: row.session_type,
      status: row.status,
    }, policies);
    if (!actions.canJoin) {
      return errorResponse(res, 409, 'JOIN_WINDOW_CLOSED', `You can join ${policies.joinWindowMinutes} minutes before your session.`);
    }
    if (String(row.session_type).toLowerCase() === 'text') {
      return res.json({ data: { mode: 'text', url: `/chat/${row.therapist_id}` } });
    }
    if (!isLegacyClientSessionJoinEnabled()) {
      return errorResponse(
        res,
        503,
        'VIDEO_PROVIDER_NOT_CONFIGURED',
        'Secure session joining is being upgraded and is not available yet.'
      );
    }
    const provider = getVideoProvider();
    let roomId = row.video_room_id;
    if (!roomId) {
      const room = await provider.createRoom({ sessionId: row.id, startsAt: row.scheduled_at, durationMinutes: row.duration_minutes });
      roomId = room.id || room.roomId;
      await pool.query('UPDATE bookings SET video_room_id = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3', [roomId, row.id, req.clientId]);
    }
    const access = await provider.createParticipantAccess({ roomId, sessionId: row.id, participantId: req.clientId, role: 'client' });
    return res.json({ data: { mode: row.session_type, ...access } });
  } catch (err) {
    if (err instanceof VideoProviderNotConfiguredError || err.code === 'VIDEO_PROVIDER_NOT_CONFIGURED') {
      return errorResponse(res, 503, 'VIDEO_PROVIDER_NOT_CONFIGURED', 'Secure session joining is being upgraded and is not available yet.');
    }
    console.error('Join session error', { code: err?.code || 'SESSION_JOIN_FAILED' });
    return errorResponse(res, 500, 'SESSION_JOIN_FAILED', 'We could not open your session.');
  }
});

module.exports = router;
