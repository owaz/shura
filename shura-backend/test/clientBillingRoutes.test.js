const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../db');
const router = require('../routes/clientBilling');

const originalQuery = pool.query;
test.afterEach(() => { pool.query = originalQuery; });

const routeHandler = (path, method) => {
  const layer = router.stack.find((item) => item.route?.path === path && item.route.methods[method]);
  if (!layer) throw new Error(`Missing ${method.toUpperCase()} ${path}`);
  return layer.route.stack.at(-1).handle;
};

const response = () => ({
  statusCode: 200,
  body: null,
  headers: {},
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.body = payload; return this; },
  set(values) { Object.assign(this.headers, values); return this; },
  send(payload) { this.body = payload; return this; },
});

test('billing summary derives covered mode and policy from server-owned data', async () => {
  pool.query = async (sql, params) => {
    if (/FROM users/.test(sql)) {
      assert.deepEqual(params, [42]);
      return { rows: [{ sessions_covered: true, timezone: 'Asia/Dubai' }] };
    }
    if (/FROM platform_settings/.test(sql)) {
      return { rows: [
        { setting_key: 'client_portal_features', setting_value: { billingEnabled: true, paymentEnabled: true } },
        { setting_key: 'session_policies', setting_value: { cancellationCutoffHours: 24, cancellationPolicyText: 'Refunds are available until 24 hours before a session.' } },
      ] };
    }
    if (/FROM bookings/.test(sql)) return { rows: [] };
    throw new Error(`Unexpected query: ${sql}`);
  };
  const res = response();
  await routeHandler('/billing/summary', 'get')({ clientId: 42 }, res);
  assert.equal(res.body.data.mode, 'covered');
  assert.equal(res.body.data.savedPaymentMethodsSupported, false);
  assert.equal(res.body.data.chargeTiming, 'at_booking');
  assert.equal(res.body.data.refundPolicy.refundableUntilHoursBeforeSession, 24);
});

test('billing summary does not mark pending paid sessions as paid', async () => {
  pool.query = async (sql, params) => {
    if (/FROM users/.test(sql)) {
      assert.deepEqual(params, [42]);
      return { rows: [{ sessions_covered: false, timezone: 'Asia/Dubai' }] };
    }
    if (/FROM platform_settings/.test(sql)) {
      return { rows: [
        { setting_key: 'client_portal_features', setting_value: { billingEnabled: true, paymentEnabled: true } },
        { setting_key: 'session_policies', setting_value: {} },
      ] };
    }
    if (/FROM bookings/.test(sql)) {
      return { rows: [{
        id: 10,
        scheduled_at: '2026-08-20T12:00:00.000Z',
        payment_kind: 'paid',
        booking_amount_minor: 125000,
        booking_currency: 'INR',
        therapist_name: 'Dr Example',
        payment_amount_minor: null,
        payment_currency: null,
        payment_status: 'pending',
        completed_at: null,
        payment_created_at: null,
      }] };
    }
    throw new Error(`Unexpected query: ${sql}`);
  };
  const res = response();
  await routeHandler('/billing/summary', 'get')({ clientId: 42 }, res);
  assert.equal(res.body.data.upcomingCharges[0].status, 'pending');
  assert.match(res.body.data.upcomingCharges[0].explanation, /Payment status: Pending/);
  assert.doesNotMatch(res.body.data.upcomingCharges[0].explanation, /Paid securely/);
});

test('transaction history scopes both sources to the client and avoids intent duplicates', async () => {
  let query;
  pool.query = async (sql, params) => {
    query = { sql, params };
    return { rows: [{
      source: 'intent', source_id: 9, booking_id: null, amount_minor: 125000,
      currency: 'INR', status: 'conflict', refund_status: 'pending', requires_refund: true,
      provider_payment_present: true, occurred_at: '2026-08-18T12:00:00.000Z',
      refund_amount_minor: null, scheduled_at: '2026-08-20T12:00:00.000Z',
      duration_minutes: 50, session_type: 'video', therapist_name: 'Dr Example', total_count: 1,
    }] };
  };
  const res = response();
  await routeHandler('/billing/transactions', 'get')({ clientId: 42, query: {} }, res);
  assert.deepEqual(query.params, [42, 20, 0]);
  assert.match(query.sql, /p\.client_id = \$1/);
  assert.match(query.sql, /intent\.client_id = \$1/);
  assert.match(query.sql, /NOT EXISTS/);
  assert.equal(res.body.data[0].id, 'intent-9');
  assert.equal(res.body.data[0].status, 'refund_pending');
  assert.equal(res.body.data[0].receiptAvailable, true);
  assert.equal(res.body.pagination.total, 1);
});

test('cross-client receipt access returns not found from an ownership-scoped query', async () => {
  let query;
  pool.query = async (sql, params) => {
    query = { sql, params };
    return { rows: [] };
  };
  const res = response();
  await routeHandler('/billing/receipt/:id', 'get')({ clientId: 42, params: { id: 'payment-7' } }, res);
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error.code, 'RECEIPT_NOT_FOUND');
  assert.deepEqual(query.params, [7, 42]);
  assert.match(query.sql, /p\.id = \$1 AND p\.client_id = \$2/);
});

test('owned captured payments download with private PDF headers', async () => {
  pool.query = async () => ({ rows: [{
    source: 'payment', source_id: 7, amount_minor: 125000, currency: 'INR',
    status: 'completed', refund_status: null, requires_refund: false,
    provider_payment_present: true, transaction_date: '2026-08-18T12:00:00.000Z',
    refund_amount_minor: 0, scheduled_at: '2026-08-20T12:00:00.000Z',
    duration_minutes: 50, session_type: 'video', therapist_name: 'Dr Example',
    client_timezone: 'Asia/Dubai',
  }] });
  const res = response();
  await routeHandler('/billing/receipt/:id', 'get')({ clientId: 42, params: { id: 'payment-7' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['Content-Type'], 'application/pdf');
  assert.equal(res.headers['Cache-Control'], 'private, no-store');
  assert.equal(res.headers['Content-Disposition'], 'attachment; filename="shura-receipt-payment-7.pdf"');
  assert.equal(Buffer.from(res.body).subarray(0, 5).toString(), '%PDF-');
});
