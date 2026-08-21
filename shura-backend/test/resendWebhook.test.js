const crypto = require('crypto');
const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../db');
const router = require('../routes/resendWebhook');

const handler = router.stack.find((layer) => layer.route?.path === '/' && layer.route.methods.post)?.route.stack[0].handle;
const originalQuery = pool.query;

const response = () => ({
  statusCode: 200,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test.afterEach(() => {
  pool.query = originalQuery;
  delete process.env.RESEND_WEBHOOK_SECRET;
});

test('accepts a signed Resend delivery event and updates the outbox', async () => {
  const secret = `whsec_${Buffer.from('webhook-secret').toString('base64')}`;
  process.env.RESEND_WEBHOOK_SECRET = secret;
  const body = JSON.stringify({
    type: 'email.delivered',
    data: { email_id: 're_msg_123' },
  });
  const eventId = 'evt_123';
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signed = `${eventId}.${timestamp}.${body}`;
  const signature = crypto
    .createHmac('sha256', Buffer.from('webhook-secret'))
    .update(signed)
    .digest('base64');
  const queries = [];
  pool.query = async (sql, params) => {
    queries.push({ sql, params });
    return queries.length === 1 ? { rowCount: 1 } : { rowCount: 1 };
  };

  const res = response();
  await handler({
    headers: {
      'svix-id': eventId,
      'svix-timestamp': timestamp,
      'svix-signature': `v1,${signature}`,
    },
    rawBody: Buffer.from(body),
    body: JSON.parse(body),
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.match(queries[1].sql, /UPDATE email_outbox/);
  assert.deepEqual(queries[1].params, ['sent', 're_msg_123']);
});

test('rejects unsigned or invalid Resend webhook requests', async () => {
  process.env.RESEND_WEBHOOK_SECRET = 'whsec_secret';
  const res = response();
  await handler({ headers: {}, rawBody: Buffer.from('{}'), body: {} }, res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'Invalid webhook signature');
});
