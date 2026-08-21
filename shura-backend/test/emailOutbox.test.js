const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../db');
const {
  applyDeliveryEvent,
  enqueueEmail,
  markAccepted,
  markFailed,
  purgeExpiredEmailData,
} = require('../utils/emailOutbox');

const originalConnect = pool.connect;
const originalQuery = pool.query;

test.afterEach(() => {
  pool.connect = originalConnect;
  pool.query = originalQuery;
});

test('enqueues through the supplied transaction client', async () => {
  let call;
  const queryable = {
    async query(sql, params) {
      call = { sql, params };
      return { rows: [{ id: 4 }] };
    },
  };

  const result = await enqueueEmail({
    eventKey: 'booking-confirmation:42',
    emailType: 'booking_confirmation',
    recipient: 'client@example.test',
    sender: 'sender@example.test',
    subject: 'Subject',
    html: '<p>Body</p>',
    text: 'Body',
  }, queryable);

  assert.deepEqual(result, {
    success: true,
    queued: true,
    duplicate: false,
    id: 4,
  });
  assert.equal(call.params[0], 'booking-confirmation:42');
  assert.match(call.sql, /ON CONFLICT \(event_key\) DO NOTHING/);
});

test('does not downgrade complained delivery state', async () => {
  const queries = [];
  const queryable = {
    async query(sql) {
      queries.push(sql);
      return {
        rows: [{
          id: 4,
          status: 'complained',
          provider_event_at: '2026-08-21T12:00:00.000Z',
        }],
      };
    },
  };

  const result = await applyDeliveryEvent(
    queryable,
    're_123',
    'email.delivered',
    '2026-08-21T12:05:00.000Z'
  );

  assert.deepEqual(result, { applied: false, missing: false });
  assert.equal(queries.length, 1);
});

test('rejects a provider event older than the current state', async () => {
  const queries = [];
  const queryable = {
    async query(sql) {
      queries.push(sql);
      return {
        rows: [{
          id: 4,
          status: 'delivered',
          provider_event_at: '2026-08-21T12:05:00.000Z',
        }],
      };
    },
  };

  const result = await applyDeliveryEvent(
    queryable,
    're_123',
    'email.bounced',
    '2026-08-21T12:00:00.000Z'
  );

  assert.equal(result.applied, false);
  assert.equal(queries.length, 1);
});

test('maps a provider failure event to dead', async () => {
  const queries = [];
  const queryable = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (/SELECT id, status/.test(sql)) {
        return {
          rows: [{
            id: 4,
            status: 'accepted',
            provider_event_at: null,
          }],
        };
      }
      return { rowCount: 1, rows: [] };
    },
  };

  const result = await applyDeliveryEvent(
    queryable,
    're_123',
    'email.failed',
    '2026-08-21T12:00:00.000Z'
  );

  assert.deepEqual(result, { applied: true, status: 'dead' });
  assert.equal(queries[1].params[0], 'dead');
  assert.match(queries[1].sql, /terminal delivery failure/);
});

test('reconciles an early provider failure after acceptance is recorded', async () => {
  const queries = [];
  const client = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (/SELECT event_type/.test(sql)) {
        return {
          rows: [{
            event_type: 'email.failed',
            provider_event_at: new Date('2026-08-21T12:00:00.000Z'),
          }],
        };
      }
      if (/SELECT id, status/.test(sql)) {
        return {
          rows: [{
            id: 4,
            status: 'accepted',
            provider_event_at: null,
          }],
        };
      }
      return { rowCount: 1, rows: [] };
    },
    release() {},
  };
  pool.connect = async () => client;

  await markAccepted(4, 're_123');

  assert.match(queries[1].sql, /status = 'accepted'/);
  assert.match(queries[4].sql, /SET status = \$1/);
  assert.equal(queries[4].params[0], 'dead');
  assert.equal(queries.at(-1).sql, 'COMMIT');
});

test('marks permanent provider errors dead without retrying', async () => {
  let call;
  pool.query = async (sql, params) => {
    call = { sql, params };
    return { rowCount: 1 };
  };

  await markFailed(4, {
    error: 'invalid sender',
    retryable: false,
  }, 1);

  assert.equal(call.params[1], 'dead');
  assert.equal(call.params[2], 'invalid sender');
});

test('honors bounded provider retry delays for retryable errors', async () => {
  let params;
  pool.query = async (_sql, values) => {
    params = values;
    return { rowCount: 1 };
  };

  await markFailed(4, {
    error: 'rate limited',
    retryable: true,
    retryAfterMs: 120000,
  }, 1);

  assert.equal(params[1], 'failed');
  assert.equal(params[3], 120000);
});

test('purges accepted and terminal payloads plus old webhook dedupe rows', async () => {
  const queries = [];
  pool.query = async (sql, params) => {
    queries.push({ sql, params });
    return { rowCount: queries.length };
  };

  const result = await purgeExpiredEmailData();

  assert.deepEqual(result, { outboxRows: 1, webhookRows: 2 });
  assert.match(queries[0].sql, /recipient = NULL/);
  assert.match(queries[0].sql, /status IN \('sent', 'accepted', 'delivered', 'dead', 'bounced', 'complained'\)/);
  assert.deepEqual(queries[0].params, [30]);
  assert.match(queries[1].sql, /DELETE FROM email_webhook_events/);
});
