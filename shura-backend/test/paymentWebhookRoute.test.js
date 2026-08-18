const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const pool = require('../db');
const router = require('../routes/payments');

const originalQuery = pool.query;
const originalSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

test.afterEach(() => {
  pool.query = originalQuery;
  if (originalSecret === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
  else process.env.RAZORPAY_WEBHOOK_SECRET = originalSecret;
});

const webhookHandler = () => {
  const layer = router.stack.find((item) => item.route?.path === '/webhook' && item.route.methods.post);
  if (!layer) throw new Error('Missing POST /webhook');
  return layer.route.stack.at(-1).handle;
};

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.body = payload; return this; },
});

test('refund webhooks reconcile booking intents without payment rows', async () => {
  process.env.RAZORPAY_WEBHOOK_SECRET = 'test_webhook_secret';
  const event = {
    event: 'refund.processed',
    payload: {
      refund: {
        entity: {
          id: 'rfnd_123',
          payment_id: 'pay_conflict',
          amount: 12500,
        },
      },
    },
  };
  const rawBody = JSON.stringify(event);
  const signature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  let intentUpdate;
  let notification;
  pool.query = async (sql, params) => {
    if (/INSERT INTO razorpay_webhook_events/.test(sql)) return { rows: [{ event_id: 'evt_refund' }] };
    if (/UPDATE payments/.test(sql)) return { rows: [], rowCount: 0 };
    if (/UPDATE payment_booking_intents/.test(sql)) {
      intentUpdate = { sql, params };
      return { rows: [{ client_id: 7, booking_id: null }], rowCount: 1 };
    }
    if (/INSERT INTO notifications/.test(sql)) {
      notification = { sql, params };
      return { rows: [{ id: 55 }] };
    }
    throw new Error(`Unexpected query: ${sql}`);
  };

  const res = response();
  await webhookHandler()({
    headers: {
      'x-razorpay-event-id': 'evt_refund',
      'x-razorpay-signature': signature,
    },
    rawBody,
    body: event,
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { received: true });
  assert.match(intentUpdate.sql, /refund_status = CASE WHEN \$1 THEN 'completed' ELSE 'failed' END/);
  assert.match(intentUpdate.sql, /requires_refund = CASE WHEN \$1 THEN FALSE ELSE requires_refund END/);
  assert.deepEqual(intentUpdate.params, [true, 'pay_conflict']);
  assert.equal(notification.params[0], 7);
  assert.equal(notification.params[1], 'refund_processed');
});
