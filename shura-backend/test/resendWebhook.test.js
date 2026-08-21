const crypto = require('crypto');
const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../db');
const router = require('../routes/resendWebhook');

const handler = router.stack
  .find((layer) => layer.route?.path === '/' && layer.route.methods.post)
  ?.route.stack[0].handle;
const originalConnect = pool.connect;

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

const signedRequest = (payload, overrides = {}) => {
  const secretBytes = Buffer.from('webhook-secret');
  process.env.RESEND_WEBHOOK_SECRET = `whsec_${secretBytes.toString('base64')}`;
  const body = JSON.stringify(payload);
  const eventId = overrides.eventId || 'evt_123';
  const timestamp = overrides.timestamp || Math.floor(Date.now() / 1000).toString();
  const signature = crypto
    .createHmac('sha256', secretBytes)
    .update(`${eventId}.${timestamp}.${body}`)
    .digest('base64');
  return {
    headers: {
      'svix-id': eventId,
      'svix-timestamp': timestamp,
      'svix-signature': `v1,${signature}`,
    },
    rawBody: Buffer.from(body),
    body: payload,
  };
};

test.afterEach(() => {
  pool.connect = originalConnect;
  delete process.env.RESEND_WEBHOOK_SECRET;
});

test('accepts a signed delivery event in one transaction', async () => {
  const queries = [];
  const client = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (/INSERT INTO email_webhook_events/.test(sql)) return { rowCount: 1 };
      if (/SELECT id, status/.test(sql)) {
        return { rows: [{ id: 9, status: 'accepted', provider_event_at: null }] };
      }
      return { rowCount: 1, rows: [] };
    },
    release() {},
  };
  pool.connect = async () => client;
  const occurredAt = '2026-08-21T12:00:00.000Z';
  const res = response();

  await handler(signedRequest({
    type: 'email.delivered',
    created_at: occurredAt,
    data: { email_id: 're_msg_123' },
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(queries[0].sql, 'BEGIN');
  assert.match(queries[1].sql, /provider_message_id, provider_event_at/);
  assert.deepEqual(queries[1].params.slice(0, 3), [
    'evt_123',
    'email.delivered',
    're_msg_123',
  ]);
  assert.match(queries[3].sql, /SET status = \$1/);
  assert.equal(queries[3].params[0], 'delivered');
  assert.equal(queries.at(-1).sql, 'COMMIT');
});

test('records a signed provider failure as dead in the webhook transaction', async () => {
  const queries = [];
  pool.connect = async () => ({
    async query(sql, params) {
      queries.push({ sql, params });
      if (/INSERT INTO email_webhook_events/.test(sql)) return { rowCount: 1 };
      if (/SELECT id, status/.test(sql)) {
        return { rows: [{ id: 9, status: 'accepted', provider_event_at: null }] };
      }
      return { rowCount: 1, rows: [] };
    },
    release() {},
  });
  const res = response();

  await handler(signedRequest({
    type: 'email.failed',
    data: { email_id: 're_msg_failed' },
  }), res);

  assert.equal(res.statusCode, 200);
  const stateUpdate = queries.find(({ sql }) => /SET status = \$1/.test(sql));
  assert.equal(stateUpdate.params[0], 'dead');
  assert.equal(queries.at(-1).sql, 'COMMIT');
});

test('acknowledges a duplicate event without applying it twice', async () => {
  const queries = [];
  pool.connect = async () => ({
    async query(sql) {
      queries.push(sql);
      if (/INSERT INTO email_webhook_events/.test(sql)) return { rowCount: 0 };
      return { rowCount: 1 };
    },
    release() {},
  });
  const res = response();

  await handler(signedRequest({
    type: 'email.bounced',
    data: { email_id: 're_msg_123' },
  }), res);

  assert.deepEqual(res.body, { ok: true, duplicate: true });
  assert.deepEqual(queries, [
    'BEGIN',
    queries[1],
    'COMMIT',
  ]);
});

test('rolls back the dedupe insert when state handling fails', async () => {
  const queries = [];
  pool.connect = async () => ({
    async query(sql) {
      queries.push(sql);
      if (/SELECT id, status/.test(sql)) throw new Error('database unavailable');
      if (/INSERT INTO email_webhook_events/.test(sql)) return { rowCount: 1 };
      return { rowCount: 1 };
    },
    release() {},
  });
  const res = response();

  await handler(signedRequest({
    type: 'email.complained',
    data: { email_id: 're_msg_123' },
  }), res);

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.error, 'Webhook processing failed');
  assert.equal(queries.at(-1), 'ROLLBACK');
});

test('rejects unsigned and stale webhook requests', async () => {
  process.env.RESEND_WEBHOOK_SECRET = 'whsec_secret';
  const unsigned = response();
  await handler({ headers: {}, rawBody: Buffer.from('{}'), body: {} }, unsigned);
  assert.equal(unsigned.statusCode, 401);

  const stale = response();
  await handler(signedRequest(
    { type: 'email.delivered', data: { email_id: 're_msg_123' } },
    { timestamp: String(Math.floor(Date.now() / 1000) - 600) }
  ), stale);
  assert.equal(stale.statusCode, 401);
});

test('acknowledges unsupported signed events without database writes', async () => {
  let connected = false;
  pool.connect = async () => {
    connected = true;
    throw new Error('should not connect');
  };
  const res = response();

  await handler(signedRequest({
    type: 'email.opened',
    data: { email_id: 're_msg_123' },
  }), res);

  assert.deepEqual(res.body, { ok: true, ignored: true });
  assert.equal(connected, false);
});
