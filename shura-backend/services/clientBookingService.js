const pool = require('../db');
const { createRazorpayClient } = require('./razorpayRefunds');
const { getImageReadUrl } = require('./azureBlobStorage');
const { syncBookingToConnectedCalendars } = require('../utils/calendarIntegrations');
const { sendBookingConfirmation, sendBookingNotificationToTherapist } = require('../utils/emailService');
const { normalizeDurations, normalizeSessionTypes } = require('../utils/clientTherapist');
const {
  paymentTerms,
  verifyRazorpaySignature,
  validateBookingSelection,
} = require('../utils/clientBookingPolicy');

const BOOKING_LOCK_NAMESPACE = 92005;

const bookingError = (code, message, statusCode = 400) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
};

const portalFeatures = async (queryable = pool) => {
  const { rows } = await queryable.query(
    `SELECT setting_value FROM platform_settings WHERE setting_key = 'client_portal_features'`
  );
  return rows[0]?.setting_value || {};
};

const loadBookingContext = async (clientId, therapistId, queryable = pool) => {
  const [assignment, features] = await Promise.all([
    queryable.query(
      `SELECT t.id, t.full_name, t.email AS therapist_email, t.status,
              t.session_types, t.session_duration_options, t.rate_60min,
              t.profile_image_url, t.profile_image_blob_name,
              t.profile_image_storage_provider,
              u.full_name AS client_name, u.email AS client_email,
              u.timezone AS client_timezone, u.sessions_covered,
              preference.session_type_preference,
              preference.session_duration_preference,
              (SELECT rule.timezone
               FROM therapist_availability_rules rule
               WHERE rule.therapist_id = t.id AND rule.is_active = TRUE
               ORDER BY rule.id ASC LIMIT 1) AS therapist_timezone
       FROM therapist_clients relationship
       JOIN therapists t ON t.id = relationship.therapist_id
       JOIN users u ON u.id = relationship.client_id
       LEFT JOIN client_preferences preference ON preference.client_id = u.id
       WHERE relationship.client_id = $1
         AND relationship.therapist_id = $2
         AND relationship.status = 'active'
         AND LOWER(COALESCE(t.status, '')) = 'approved'
       ORDER BY relationship.assigned_at DESC NULLS LAST, relationship.id DESC
       LIMIT 1`,
      [clientId, therapistId]
    ),
    portalFeatures(queryable),
  ]);
  const row = assignment.rows[0];
  if (!row) throw bookingError('THERAPIST_NOT_BOOKABLE', 'You can only book with your active, approved therapist.', 404);
  const sessionTypes = normalizeSessionTypes(row.session_types);
  const durations = normalizeDurations(row.session_duration_options);
  return {
    ...row,
    clientTimezone: row.client_timezone || 'UTC',
    therapistTimezone: row.therapist_timezone || 'UTC',
    sessionTypes,
    durationOptions: durations.length ? durations : [50],
    paymentEnabled: features.paymentEnabled !== false,
    sessionsCovered: Boolean(row.sessions_covered),
  };
};

const termsForContext = (context, durationMinutes) => paymentTerms({
  paymentEnabled: context.paymentEnabled,
  sessionsCovered: context.sessionsCovered,
  rate60Minutes: context.rate_60min || 0,
  durationMinutes,
});

const bookingOptionsDto = async (context) => {
  let imageUrl = context.profile_image_url || '';
  if (context.profile_image_storage_provider === 'azure_blob' && context.profile_image_blob_name) {
    imageUrl = await getImageReadUrl(context.profile_image_blob_name);
  }
  const preferredType = context.sessionTypes.includes(context.session_type_preference)
    ? context.session_type_preference
    : context.sessionTypes[0] || null;
  const preferredDuration = context.durationOptions.includes(Number(context.session_duration_preference))
    ? Number(context.session_duration_preference)
    : context.durationOptions[0] || null;
  return {
    therapist: { id: context.id, name: context.full_name, imageUrl },
    sessionTypes: context.sessionTypes,
    durations: context.durationOptions.map((minutes) => ({
      minutes,
      ...termsForContext(context, minutes),
    })),
    defaults: { sessionType: preferredType, durationMinutes: preferredDuration },
    clientTimezone: context.clientTimezone,
    therapistTimezone: context.therapistTimezone,
    timezoneDiffers: context.clientTimezone !== context.therapistTimezone,
    paymentEnabled: context.paymentEnabled,
    sessionsCovered: context.sessionsCovered,
  };
};

const assertAvailableSlot = async (queryable, { therapistId, scheduledAt, durationMinutes, excludeBookingId = 0 }) => {
  const rule = await queryable.query(
    `SELECT rule.timezone
     FROM therapist_availability_rules rule
     WHERE rule.therapist_id = $1
       AND rule.is_active = TRUE
       AND $2::timestamptz > NOW()
       AND rule.day_of_week = EXTRACT(DOW FROM ($2::timestamptz AT TIME ZONE rule.timezone))::integer
       AND ($2::timestamptz AT TIME ZONE rule.timezone)::time >= rule.start_time
       AND (($2::timestamptz + make_interval(mins => $3)) AT TIME ZONE rule.timezone)::time <= rule.end_time
       AND MOD(
         (EXTRACT(EPOCH FROM ((($2::timestamptz AT TIME ZONE rule.timezone)::time - rule.start_time))) / 60)::numeric,
         rule.slot_minutes::numeric
       ) = 0
     ORDER BY rule.id ASC
     LIMIT 1`,
    [therapistId, scheduledAt, durationMinutes]
  );
  if (!rule.rows.length) {
    throw bookingError('SLOT_OUTSIDE_AVAILABILITY', 'The selected time is outside your therapist’s current availability.');
  }
  const conflicts = await queryable.query(
    `SELECT EXISTS (
       SELECT 1 FROM therapist_blocked_times blocked
       WHERE blocked.therapist_id = $1
         AND blocked.starts_at < $2::timestamptz + make_interval(mins => $3)
         AND blocked.ends_at > $2::timestamptz
     ) OR EXISTS (
       SELECT 1 FROM bookings existing
       WHERE existing.therapist_id = $1
         AND existing.id <> $4
         AND LOWER(COALESCE(existing.status, '')) <> 'cancelled'
         AND existing.scheduled_at < $2::timestamptz + make_interval(mins => $3)
         AND existing.scheduled_at + make_interval(mins => COALESCE(existing.duration_minutes, 50)) > $2::timestamptz
     ) AS unavailable`,
    [therapistId, scheduledAt, durationMinutes, excludeBookingId]
  );
  if (conflicts.rows[0]?.unavailable) {
    throw bookingError('SLOT_CONFLICT', 'That time was just taken. Please choose another available time.', 409);
  }
  return rule.rows[0].timezone;
};

const listAvailableSlots = async ({ clientId, therapistId, from, to, sessionType, durationMinutes }) => {
  const context = await loadBookingContext(clientId, therapistId);
  const selection = validateBookingSelection({
    therapistId,
    sessionType,
    durationMinutes,
    scheduledAt: '2099-01-01T00:00:00.000Z',
  }, context);
  if (selection.errors.sessionType || selection.errors.durationMinutes) {
    throw bookingError('OFFERING_NOT_AVAILABLE', selection.errors.sessionType || selection.errors.durationMinutes);
  }
  const { rows } = await pool.query(
    `WITH days AS (
       SELECT day::date
       FROM generate_series(($2::date - 2), ($3::date + 2), interval '1 day') AS day
     ), candidates AS (
       SELECT slot AS scheduled_at, rule.timezone AS therapist_timezone
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
     SELECT candidate.scheduled_at, candidate.therapist_timezone
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
           AND LOWER(COALESCE(existing.status, '')) <> 'cancelled'
           AND existing.scheduled_at < candidate.scheduled_at + make_interval(mins => $5)
           AND existing.scheduled_at + make_interval(mins => COALESCE(existing.duration_minutes, 50)) > candidate.scheduled_at
       )
     ORDER BY candidate.scheduled_at ASC
     LIMIT 400`,
    [therapistId, from, to, context.clientTimezone, durationMinutes]
  );
  return {
    clientTimezone: context.clientTimezone,
    therapistTimezone: context.therapistTimezone,
    timezoneDiffers: context.clientTimezone !== context.therapistTimezone,
    slots: rows.map((row) => ({ scheduledAt: row.scheduled_at, therapistTimezone: row.therapist_timezone })),
  };
};

const bookingDtoFromRow = (row) => ({
  id: Number(row.id),
  therapist: { id: Number(row.therapist_id), name: row.therapist_name },
  scheduledAt: row.scheduled_at,
  durationMinutes: Number(row.duration_minutes),
  sessionType: row.session_type,
  status: String(row.status || 'confirmed').toLowerCase(),
  payment: {
    kind: row.payment_kind || (Number(row.amount_cents || 0) > 0 ? 'paid' : 'free'),
    amountMinor: Number(row.amount_cents || 0),
    currency: row.currency || 'INR',
  },
  clientTimezone: row.client_timezone || 'UTC',
  calendarDownloadUrl: `/api/client/bookings/${Number(row.id)}/calendar.ics`,
});

const loadOwnedBooking = async (clientId, bookingId, queryable = pool) => {
  const { rows } = await queryable.query(
    `SELECT b.id, b.user_id, b.therapist_id, b.scheduled_at, b.duration_minutes,
            b.session_type, b.status, b.payment_kind, b.amount_cents, b.currency,
            t.full_name AS therapist_name, u.timezone AS client_timezone
     FROM bookings b
     JOIN therapists t ON t.id = b.therapist_id
     JOIN users u ON u.id = b.user_id
     WHERE b.id = $1 AND b.user_id = $2`,
    [bookingId, clientId]
  );
  return rows[0] || null;
};

const insertConfirmedBooking = async (queryable, { clientId, context, selection, terms, therapistTimezone }) => {
  const { rows } = await queryable.query(
    `INSERT INTO bookings
      (user_id, therapist_id, date, time, scheduled_at, duration_minutes,
       session_type, status, amount_cents, payment_kind, currency)
     VALUES (
       $1, $2,
       ($3::timestamptz AT TIME ZONE $4)::date,
       TO_CHAR($3::timestamptz AT TIME ZONE $4, 'HH24:MI'),
       $3, $5, $6, 'confirmed', $7, $8, $9
     )
     RETURNING *`,
    [
      clientId,
      context.id,
      selection.scheduledAt,
      therapistTimezone,
      selection.durationMinutes,
      selection.sessionType,
      terms.amountMinor,
      terms.kind,
      terms.currency,
    ]
  );
  const booking = rows[0];
  await queryable.query(
    `INSERT INTO notifications (client_id, type, title, body, metadata)
     VALUES ($1, 'session_booked', 'Session confirmed',
             'Your session has been booked successfully.', $2::jsonb)`,
    [clientId, JSON.stringify({ bookingId: booking.id, scheduledAt: booking.scheduled_at })]
  );
  const emailData = {
    bookingId: booking.id,
    clientId,
    clientName: context.client_name,
    clientEmail: context.client_email,
    therapistName: context.full_name,
    therapistEmail: context.therapist_email,
    date: booking.date,
    time: booking.time,
    sessionType: booking.session_type,
  };
  const emailResults = await Promise.all([
    sendBookingConfirmation(emailData, queryable),
    sendBookingNotificationToTherapist(emailData, queryable),
  ]);
  const failedEmail = emailResults.find((result) => !result.success);
  if (failedEmail) {
    throw bookingError('EMAIL_QUEUE_FAILED', failedEmail.error || 'Booking email could not be queued.');
  }
  return booking;
};

const postBookingSideEffects = (booking) => {
  void Promise.allSettled([
    syncBookingToConnectedCalendars(booking.id),
  ]).then((results) => results.filter((result) => result.status === 'rejected')
    .forEach((result) => console.error('Post-booking side effect failed', {
      code: result.reason?.code || 'SIDE_EFFECT_FAILED',
    })));
};

const createFreeOrCoveredBooking = async ({ clientId, therapistId, payload }) => {
  const client = await pool.connect();
  let booking;
  let context;
  try {
    await client.query('BEGIN');
    context = await loadBookingContext(clientId, therapistId, client);
    const validation = validateBookingSelection(payload, context);
    if (Object.keys(validation.errors).length) throw bookingError('VALIDATION_FAILED', 'Review the selected booking details.');
    const terms = termsForContext(context, validation.values.durationMinutes);
    if (!terms || terms.paymentRequired) throw bookingError('PAYMENT_REQUIRED', 'Payment is required for this session.', 409);
    await client.query('SELECT pg_advisory_xact_lock($1, $2)', [BOOKING_LOCK_NAMESPACE, therapistId]);
    const therapistTimezone = await assertAvailableSlot(client, {
      therapistId,
      scheduledAt: validation.values.scheduledAt,
      durationMinutes: validation.values.durationMinutes,
    });
    booking = await insertConfirmedBooking(client, {
      clientId, context, selection: validation.values, terms, therapistTimezone,
    });
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.code === '23P01' || error.code === '23505') {
      throw bookingError('SLOT_CONFLICT', 'That time was just taken. Please choose another available time.', 409);
    }
    throw error;
  } finally {
    client.release();
  }
  postBookingSideEffects(booking);
  return bookingDtoFromRow({ ...booking, therapist_name: context.full_name, client_timezone: context.clientTimezone });
};

const createPaidBookingIntent = async ({ clientId, therapistId, payload }) => {
  const context = await loadBookingContext(clientId, therapistId);
  const validation = validateBookingSelection(payload, context);
  if (Object.keys(validation.errors).length) {
    const error = bookingError('VALIDATION_FAILED', 'Review the selected booking details.');
    error.details = validation.errors;
    throw error;
  }
  const terms = termsForContext(context, validation.values.durationMinutes);
  if (!terms) throw bookingError('PRICE_NOT_CONFIGURED', 'A price is not configured for this session.');
  if (!terms.paymentRequired) {
    return { kind: 'confirmed', booking: await createFreeOrCoveredBooking({ clientId, therapistId, payload }) };
  }
  await assertAvailableSlot(pool, {
    therapistId,
    scheduledAt: validation.values.scheduledAt,
    durationMinutes: validation.values.durationMinutes,
  });
  let razorpay;
  try {
    razorpay = createRazorpayClient();
  } catch (error) {
    throw bookingError('PAYMENT_NOT_CONFIGURED', 'Online payment is not available right now.', 503);
  }
  let order;
  try {
    order = await razorpay.orders.create({
      amount: terms.amountMinor,
      currency: terms.currency,
      receipt: `portal-${clientId}-${Date.now()}`.slice(0, 40),
      notes: {
        client_id: String(clientId),
        therapist_id: String(therapistId),
        session_type: validation.values.sessionType,
        duration_minutes: String(validation.values.durationMinutes),
      },
    });
  } catch {
    throw bookingError('PAYMENT_ORDER_FAILED', 'Secure checkout could not be started. Please try again.', 502);
  }
  await pool.query(
    `INSERT INTO payment_booking_intents
      (order_id, client_id, therapist_id, booking_date, booking_time,
       scheduled_at, duration_minutes, session_type, amount_cents, currency,
       client_timezone, therapist_timezone, intent_source, status, created_at, updated_at)
     VALUES (
       $1, $2, $3,
       ($4::timestamptz AT TIME ZONE $5)::date,
       TO_CHAR($4::timestamptz AT TIME ZONE $5, 'HH24:MI'),
       $4, $6, $7, $8, $9, $10, $5, 'client_portal', 'initiated', NOW(), NOW()
     )`,
    [
      order.id,
      clientId,
      therapistId,
      validation.values.scheduledAt,
      context.therapistTimezone,
      validation.values.durationMinutes,
      validation.values.sessionType,
      terms.amountMinor,
      terms.currency,
      context.clientTimezone,
    ]
  );
  return {
    kind: 'payment_required',
    intent: { orderId: order.id, status: 'initiated' },
    checkout: {
      keyId: process.env.RAZORPAY_KEY_ID,
      orderId: order.id,
      amountMinor: Number(order.amount),
      currency: order.currency || terms.currency,
    },
  };
};

const verifyPaymentSignature = ({ orderId, paymentId, signature }) => {
  if (!process.env.RAZORPAY_KEY_SECRET) throw bookingError('PAYMENT_NOT_CONFIGURED', 'Online payment is not available right now.', 503);
  return verifyRazorpaySignature({
    orderId,
    paymentId,
    signature,
    secret: process.env.RAZORPAY_KEY_SECRET,
  });
};

const markIntentConflict = async ({ orderId, paymentId, failureCode = 'SLOT_CONFLICT' }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT * FROM payment_booking_intents WHERE order_id = $1 FOR UPDATE`,
      [orderId]
    );
    const intent = rows[0];
    if (!intent) {
      await client.query('ROLLBACK');
      return null;
    }
    if (intent.status === 'completed' || intent.status === 'conflict') {
      await client.query('COMMIT');
      return intent;
    }
    const { rows: updated } = await client.query(
      `UPDATE payment_booking_intents
       SET status = 'conflict', provider_payment_id = COALESCE(provider_payment_id, $2),
           failure_code = $3, requires_refund = TRUE,
           refund_status = COALESCE(refund_status, 'required'),
           conflicted_at = COALESCE(conflicted_at, NOW()), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [intent.id, paymentId, failureCode]
    );
    await client.query('COMMIT');
    return updated[0] || null;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};

const finalizePaidBookingIntent = async ({ orderId, paymentId, expectedClientId = null }) => {
  const client = await pool.connect();
  let booking;
  let context;
  let intent;
  try {
    await client.query('BEGIN');
    const params = expectedClientId === null ? [orderId] : [orderId, expectedClientId];
    const { rows } = await client.query(
      `SELECT * FROM payment_booking_intents
       WHERE order_id = $1 ${expectedClientId === null ? '' : 'AND client_id = $2'}
       FOR UPDATE`,
      params
    );
    intent = rows[0];
    if (!intent) {
      await client.query('ROLLBACK');
      return { status: 'not_found' };
    }
    if (intent.status === 'completed' && intent.booking_id) {
      booking = await loadOwnedBooking(intent.client_id, intent.booking_id, client);
      await client.query('COMMIT');
      return { status: 'completed', booking: bookingDtoFromRow(booking), replayed: true };
    }
    if (intent.status === 'conflict') {
      await client.query('COMMIT');
      return { status: 'conflict', intent };
    }
    const existingPayment = await client.query(
      `SELECT id, booking_id, client_id, razorpay_order_id
       FROM payments WHERE razorpay_payment_id = $1 LIMIT 1 FOR UPDATE`,
      [paymentId]
    );
    if (existingPayment.rows.length) {
      const payment = existingPayment.rows[0];
      if (Number(payment.client_id) !== Number(intent.client_id) || payment.razorpay_order_id !== orderId) {
        throw bookingError('PAYMENT_ALREADY_USED', 'This payment has already been used.', 409);
      }
      if (payment.booking_id) {
        booking = await loadOwnedBooking(intent.client_id, payment.booking_id, client);
        await client.query(
          `UPDATE payment_booking_intents SET status = 'completed', booking_id = $1,
             payment_id = $2, provider_payment_id = $3, finalized_at = NOW(), updated_at = NOW()
           WHERE id = $4`,
          [payment.booking_id, payment.id, paymentId, intent.id]
        );
        await client.query('COMMIT');
        return { status: 'completed', booking: bookingDtoFromRow(booking), replayed: true };
      }
    }
    context = await loadBookingContext(intent.client_id, intent.therapist_id, client);
    const selection = validateBookingSelection({
      therapistId: intent.therapist_id,
      sessionType: intent.session_type,
      durationMinutes: intent.duration_minutes,
      scheduledAt: intent.scheduled_at,
    }, context);
    if (Object.keys(selection.errors).length) {
      throw bookingError('OFFERING_NOT_AVAILABLE', 'This therapist offering is no longer available.', 409);
    }
    await client.query('SELECT pg_advisory_xact_lock($1, $2)', [BOOKING_LOCK_NAMESPACE, intent.therapist_id]);
    const therapistTimezone = await assertAvailableSlot(client, {
      therapistId: intent.therapist_id,
      scheduledAt: selection.values.scheduledAt,
      durationMinutes: selection.values.durationMinutes,
    });
    booking = await insertConfirmedBooking(client, {
      clientId: intent.client_id,
      context,
      selection: selection.values,
      terms: { kind: 'paid', amountMinor: Number(intent.amount_cents), currency: intent.currency || 'INR' },
      therapistTimezone,
    });
    const paymentResult = await client.query(
      `INSERT INTO payments
        (booking_id, client_id, therapist_id, amount_cents, currency, status,
         razorpay_order_id, razorpay_payment_id, completed_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'completed', $6, $7, NOW(), NOW(), NOW())
       RETURNING id`,
      [booking.id, intent.client_id, intent.therapist_id, intent.amount_cents, intent.currency || 'INR', orderId, paymentId]
    );
    await client.query(
      `UPDATE payment_booking_intents
       SET status = 'completed', booking_id = $1, payment_id = $2,
           provider_payment_id = $3, requires_refund = FALSE, failure_code = NULL,
           finalized_at = NOW(), updated_at = NOW()
       WHERE id = $4`,
      [booking.id, paymentResult.rows[0].id, paymentId, intent.id]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    const paidConflictCodes = new Set([
      'SLOT_CONFLICT',
      'SLOT_OUTSIDE_AVAILABILITY',
      'THERAPIST_NOT_BOOKABLE',
      'OFFERING_NOT_AVAILABLE',
      '23P01',
      '23505',
    ]);
    if (paidConflictCodes.has(error.code)) {
      const failureCode = ['23P01', '23505'].includes(error.code) ? 'SLOT_CONFLICT' : error.code;
      const conflictedIntent = await markIntentConflict({ orderId, paymentId, failureCode });
      if (conflictedIntent && conflictedIntent.status === 'completed' && conflictedIntent.booking_id) {
        const winningBooking = await loadOwnedBooking(conflictedIntent.client_id, conflictedIntent.booking_id);
        return { status: 'completed', booking: bookingDtoFromRow(winningBooking), replayed: true };
      }
      return { status: 'conflict', intent: conflictedIntent };
    }
    throw error;
  } finally {
    client.release();
  }
  postBookingSideEffects(booking);
  return {
    status: 'completed',
    booking: bookingDtoFromRow({ ...booking, therapist_name: context.full_name, client_timezone: context.clientTimezone }),
    replayed: false,
  };
};

const intentDto = async (row) => {
  let booking = null;
  if (row.booking_id) {
    const bookingRow = await loadOwnedBooking(row.client_id, row.booking_id);
    if (bookingRow) booking = bookingDtoFromRow(bookingRow);
  }
  return {
    orderId: row.order_id,
    status: row.status,
    amountMinor: Number(row.amount_cents),
    currency: row.currency || 'INR',
    requiresRefund: Boolean(row.requires_refund),
    refundStatus: row.refund_status || null,
    failureCode: row.failure_code || null,
    booking,
    updatedAt: row.updated_at,
  };
};

const loadOwnedIntent = async (clientId, orderId) => {
  const { rows } = await pool.query(
    `SELECT * FROM payment_booking_intents WHERE order_id = $1 AND client_id = $2`,
    [orderId, clientId]
  );
  return rows[0] ? intentDto(rows[0]) : null;
};

module.exports = {
  bookingOptionsDto,
  createPaidBookingIntent,
  finalizePaidBookingIntent,
  listAvailableSlots,
  loadBookingContext,
  loadOwnedBooking,
  loadOwnedIntent,
  verifyPaymentSignature,
};
