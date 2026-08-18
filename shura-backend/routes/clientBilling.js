const express = require('express');
const rateLimit = require('express-rate-limit');
const pool = require('../db');
const { errorResponse, parsePagination, paginatedResponse } = require('../utils/apiResponse');
const { normalizePolicies } = require('../utils/clientSessionPolicy');
const {
  billingMode,
  billingRecordId,
  normalizedBillingStatus,
  parseReceiptId,
  receiptAvailable,
  statusLabel,
  transactionReference,
} = require('../utils/clientBilling');
const { generateReceiptPdf } = require('../services/clientReceiptPdf');

const router = express.Router();

const receiptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

const sessionTypeLabel = (value) => ({
  video: 'Video session',
  audio: 'Audio session',
  text: 'Text session',
  intro: 'Introductory session',
}[String(value || '').toLowerCase()] || 'Session');

const mapUpcomingItem = (row) => {
  const kind = ['paid', 'covered', 'free'].includes(row.payment_kind) ? row.payment_kind : 'paid';
  const paymentStatus = normalizedBillingStatus({ status: row.payment_status });
  return {
    bookingId: Number(row.id),
    sessionDate: row.scheduled_at,
    therapist: row.therapist_name,
    amountMinor: kind === 'paid' ? Number(row.payment_amount_minor ?? row.booking_amount_minor ?? 0) : 0,
    currency: row.payment_currency || row.booking_currency || 'INR',
    chargeDate: kind === 'paid' ? row.completed_at || row.payment_created_at || null : null,
    kind,
    status: kind === 'paid' ? paymentStatus : kind,
    explanation: kind === 'covered'
      ? 'Covered by your plan. No charge will be made.'
      : kind === 'free'
        ? 'No payment is required for this session.'
        : 'Paid securely at booking. Shura does not schedule an automatic future charge.',
  };
};

const mapTransaction = (row) => {
  const status = normalizedBillingStatus({
    status: row.status,
    refundStatus: row.refund_status,
    requiresRefund: row.requires_refund,
  });
  const source = row.source;
  const sourceId = Number(row.source_id);
  return {
    id: billingRecordId(source, sourceId),
    reference: transactionReference(source, sourceId),
    date: row.occurred_at,
    description: row.therapist_name
      ? `${sessionTypeLabel(row.session_type)} with ${row.therapist_name}`
      : source === 'intent' ? 'Session payment attempt' : 'Session payment',
    amountMinor: Number(row.amount_minor || 0),
    currency: row.currency || 'INR',
    status,
    refundAmountMinor: Number(row.refund_amount_minor || 0),
    receiptAvailable: receiptAvailable({
      source,
      status,
      providerPaymentPresent: Boolean(row.provider_payment_present),
    }),
    appointment: row.scheduled_at ? {
      bookingId: row.booking_id ? Number(row.booking_id) : null,
      scheduledAt: row.scheduled_at,
      durationMinutes: Number(row.duration_minutes || 50),
      sessionType: String(row.session_type || 'video').toLowerCase(),
      therapist: row.therapist_name || 'Therapist',
    } : null,
  };
};

router.get('/billing/summary', async (req, res) => {
  try {
    const [clientResult, settingsResult, upcomingResult] = await Promise.all([
      pool.query(
        `SELECT sessions_covered, timezone
         FROM users
         WHERE id = $1`,
        [req.clientId]
      ),
      pool.query(
        `SELECT setting_key, setting_value
         FROM platform_settings
         WHERE setting_key IN ('client_portal_features', 'session_policies')`
      ),
      pool.query(
        `SELECT b.id, b.scheduled_at, b.payment_kind,
                b.amount_cents AS booking_amount_minor, b.currency AS booking_currency,
                t.full_name AS therapist_name,
                payment.amount_cents AS payment_amount_minor,
                payment.currency AS payment_currency,
                payment.status AS payment_status,
                payment.completed_at, payment.created_at AS payment_created_at
         FROM bookings b
         JOIN therapists t ON t.id = b.therapist_id
         LEFT JOIN LATERAL (
           SELECT p.amount_cents, p.currency, p.status, p.completed_at, p.created_at
           FROM payments p
           WHERE p.booking_id = b.id AND p.client_id = b.user_id
           ORDER BY p.created_at DESC, p.id DESC
           LIMIT 1
         ) payment ON TRUE
         WHERE b.user_id = $1
           AND b.scheduled_at IS NOT NULL
           AND b.scheduled_at + make_interval(mins => COALESCE(b.duration_minutes, 50)) >= NOW()
           AND LOWER(COALESCE(b.status, 'pending')) IN ('pending', 'confirmed', 'upcoming', 'live')
         ORDER BY b.scheduled_at ASC, b.id ASC
         LIMIT 10`,
        [req.clientId]
      ),
    ]);

    const client = clientResult.rows[0];
    if (!client) return errorResponse(res, 404, 'CLIENT_NOT_FOUND', 'Your client profile could not be found.');
    const settings = Object.fromEntries(settingsResult.rows.map((row) => [row.setting_key, row.setting_value]));
    const features = settings.client_portal_features || {};
    const policies = normalizePolicies(settings.session_policies || {});
    const mode = billingMode({
      billingEnabled: features.billingEnabled === true,
      paymentEnabled: features.paymentEnabled !== false,
      sessionsCovered: Boolean(client.sessions_covered),
    });

    return res.json({
      data: {
        mode,
        billingEnabled: features.billingEnabled === true,
        paymentEnabled: features.paymentEnabled !== false,
        sessionsCovered: Boolean(client.sessions_covered),
        savedPaymentMethodsSupported: false,
        savedPaymentMethod: null,
        chargeTiming: 'at_booking',
        timezone: client.timezone || 'UTC',
        upcomingCharges: upcomingResult.rows.map(mapUpcomingItem),
        refundPolicy: {
          text: policies.cancellationPolicyText,
          refundableUntilHoursBeforeSession: policies.cancellationCutoffHours,
        },
      },
    });
  } catch (error) {
    console.error('GET /api/client/billing/summary error', { code: error?.code || 'BILLING_SUMMARY_FAILED' });
    return errorResponse(res, 500, 'BILLING_SUMMARY_FAILED', 'We could not load your billing summary.');
  }
});

router.get('/billing/transactions', async (req, res) => {
  const pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 50 });
  try {
    const { rows } = await pool.query(
      `WITH billing_records AS (
         SELECT 'payment'::text AS source,
                p.id::bigint AS source_id,
                p.booking_id,
                p.amount_cents AS amount_minor,
                COALESCE(p.currency, 'INR') AS currency,
                p.status,
                p.refund_status,
                FALSE AS requires_refund,
                (p.razorpay_payment_id IS NOT NULL) AS provider_payment_present,
                COALESCE(p.completed_at, p.updated_at, p.created_at) AS occurred_at,
                p.refund_amount_cents AS refund_amount_minor,
                b.scheduled_at, b.duration_minutes, b.session_type,
                t.full_name AS therapist_name
         FROM payments p
         LEFT JOIN bookings b ON b.id = p.booking_id
         LEFT JOIN therapists t ON t.id = COALESCE(b.therapist_id, p.therapist_id)
         WHERE p.client_id = $1

         UNION ALL

         SELECT 'intent'::text AS source,
                intent.id::bigint AS source_id,
                intent.booking_id,
                intent.amount_cents AS amount_minor,
                COALESCE(intent.currency, 'INR') AS currency,
                intent.status,
                intent.refund_status,
                intent.requires_refund,
                (intent.provider_payment_id IS NOT NULL) AS provider_payment_present,
                COALESCE(intent.updated_at, intent.created_at) AS occurred_at,
                NULL::integer AS refund_amount_minor,
                intent.scheduled_at, intent.duration_minutes, intent.session_type,
                t.full_name AS therapist_name
         FROM payment_booking_intents intent
         LEFT JOIN therapists t ON t.id = intent.therapist_id
         WHERE intent.client_id = $1
           AND NOT EXISTS (
             SELECT 1
             FROM payments payment
             WHERE payment.client_id = intent.client_id
               AND (payment.id = intent.payment_id OR payment.razorpay_order_id = intent.order_id)
           )
       )
       SELECT billing_records.*, COUNT(*) OVER ()::integer AS total_count
       FROM billing_records
       ORDER BY occurred_at DESC, source DESC, source_id DESC
       LIMIT $2 OFFSET $3`,
      [req.clientId, pagination.limit, pagination.offset]
    );
    const total = Number(rows[0]?.total_count || 0);
    return paginatedResponse(res, rows.map(mapTransaction), { ...pagination, total });
  } catch (error) {
    console.error('GET /api/client/billing/transactions error', { code: error?.code || 'BILLING_TRANSACTIONS_FAILED' });
    return errorResponse(res, 500, 'BILLING_TRANSACTIONS_FAILED', 'We could not load your payment history.');
  }
});

const loadOwnedReceipt = async ({ source, id, clientId }) => {
  const paymentSql = `
    SELECT 'payment'::text AS source, p.id::bigint AS source_id,
           p.amount_cents AS amount_minor, COALESCE(p.currency, 'INR') AS currency,
           p.status, p.refund_status, FALSE AS requires_refund,
           (p.razorpay_payment_id IS NOT NULL) AS provider_payment_present,
           COALESCE(p.completed_at, p.created_at) AS transaction_date,
           p.refund_amount_cents AS refund_amount_minor,
           b.scheduled_at, b.duration_minutes, b.session_type,
           t.full_name AS therapist_name, u.timezone AS client_timezone
    FROM payments p
    JOIN users u ON u.id = p.client_id
    LEFT JOIN bookings b ON b.id = p.booking_id
    LEFT JOIN therapists t ON t.id = COALESCE(b.therapist_id, p.therapist_id)
    WHERE p.id = $1 AND p.client_id = $2`;
  const intentSql = `
    SELECT 'intent'::text AS source, intent.id::bigint AS source_id,
           intent.amount_cents AS amount_minor, COALESCE(intent.currency, 'INR') AS currency,
           intent.status, intent.refund_status, intent.requires_refund,
           (intent.provider_payment_id IS NOT NULL) AS provider_payment_present,
           COALESCE(intent.conflicted_at, intent.updated_at, intent.created_at) AS transaction_date,
           NULL::integer AS refund_amount_minor,
           intent.scheduled_at, intent.duration_minutes, intent.session_type,
           t.full_name AS therapist_name, u.timezone AS client_timezone
    FROM payment_booking_intents intent
    JOIN users u ON u.id = intent.client_id
    LEFT JOIN therapists t ON t.id = intent.therapist_id
    WHERE intent.id = $1 AND intent.client_id = $2`;
  const { rows } = await pool.query(source === 'payment' ? paymentSql : intentSql, [id, clientId]);
  return rows[0] || null;
};

router.get('/billing/receipt/:id', receiptLimiter, async (req, res) => {
  const receiptId = parseReceiptId(req.params.id);
  if (!receiptId) return errorResponse(res, 400, 'INVALID_RECEIPT_ID', 'Choose a valid receipt.');
  try {
    const row = await loadOwnedReceipt({ ...receiptId, clientId: req.clientId });
    if (!row) return errorResponse(res, 404, 'RECEIPT_NOT_FOUND', 'This receipt could not be found.');
    const status = normalizedBillingStatus({
      status: row.status,
      refundStatus: row.refund_status,
      requiresRefund: row.requires_refund,
    });
    if (!receiptAvailable({
      source: row.source,
      status,
      providerPaymentPresent: Boolean(row.provider_payment_present),
    })) {
      return errorResponse(res, 409, 'RECEIPT_NOT_AVAILABLE', 'A receipt is available after a payment has been captured.');
    }

    const sourceId = Number(row.source_id);
    const reference = transactionReference(row.source, sourceId);
    const refundStatus = String(row.refund_status || '').toLowerCase();
    const refundStatusLabel = {
      completed: 'Completed',
      processed: 'Completed',
      pending: 'Pending',
      failed: 'Failed',
      required: 'Required',
    }[refundStatus] || null;
    const pdf = await generateReceiptPdf({
      reference,
      amountMinor: Number(row.amount_minor || 0),
      currency: row.currency || 'INR',
      statusLabel: statusLabel(status),
      transactionDate: row.transaction_date,
      refundStatusLabel,
      refundAmountMinor: Number(row.refund_amount_minor || 0),
      therapistName: row.therapist_name,
      scheduledAt: row.scheduled_at,
      clientTimezone: row.client_timezone || 'UTC',
      sessionTypeLabel: sessionTypeLabel(row.session_type),
      durationMinutes: Number(row.duration_minutes || 0),
    });
    const filename = `shura-receipt-${billingRecordId(row.source, sourceId)}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(pdf.length),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    return res.status(200).send(pdf);
  } catch (error) {
    console.error('GET /api/client/billing/receipt/:id error', { code: error?.code || 'RECEIPT_GENERATION_FAILED' });
    return errorResponse(res, 500, 'RECEIPT_GENERATION_FAILED', 'We could not generate this receipt.');
  }
});

module.exports = router;
module.exports.loadOwnedReceipt = loadOwnedReceipt;
module.exports.mapTransaction = mapTransaction;
module.exports.mapUpcomingItem = mapUpcomingItem;
