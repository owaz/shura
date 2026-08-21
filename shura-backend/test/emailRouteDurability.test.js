const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../db');
const authRouter = require('../routes/auth');
const bookingsRouter = require('../routes/bookings');

const originalConnect = pool.connect;
const originalQuery = pool.query;
const originalAdminEmail = process.env.ADMIN_EMAIL;
const originalSender = process.env.RESEND_FROM_EMAIL;

const routeHandler = (router, path, method) => router.stack
  .find((layer) => layer.route?.path === path && layer.route.methods[method])
  ?.route.stack.at(-1).handle;

const questionnaireHandler = routeHandler(authRouter, '/questionnaire', 'post');
const cancelBookingHandler = routeHandler(bookingsRouter, '/:id/cancel', 'put');

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

test.beforeEach(() => {
  process.env.ADMIN_EMAIL = 'admin@example.test';
  process.env.RESEND_FROM_EMAIL = 'sender@example.test';
});

test.afterEach(() => {
  pool.connect = originalConnect;
  pool.query = originalQuery;
  if (originalAdminEmail === undefined) delete process.env.ADMIN_EMAIL;
  else process.env.ADMIN_EMAIL = originalAdminEmail;
  if (originalSender === undefined) delete process.env.RESEND_FROM_EMAIL;
  else process.env.RESEND_FROM_EMAIL = originalSender;
});

test('questionnaire submission fails when durable email intent cannot be queued', async () => {
  pool.query = async (sql) => {
    if (/SELECT id, email, full_name FROM users/.test(sql)) {
      return { rows: [{ id: 7, email: 'client@example.test', full_name: 'Client' }] };
    }
    if (/INSERT INTO email_outbox/.test(sql)) throw new Error('outbox unavailable');
    throw new Error(`Unexpected query: ${sql}`);
  };
  const res = response();

  await questionnaireHandler({
    user: { id: 7, role: 'client' },
    body: { concerns: [], gender: null, notes: null },
  }, res);

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.error, 'Unable to submit the questionnaire.');
});

test('legacy booking cancellation queues both emails in the cancellation transaction', async () => {
  const queries = [];
  const client = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (/SELECT b\.\*/.test(sql)) {
        return {
          rows: [{
            id: 42,
            user_id: 7,
            date: '2026-08-28',
            time: '10:00:00',
            client_name: 'Client',
            client_email: 'client@example.test',
            therapist_name: 'Therapist',
            therapist_email: 'therapist@example.test',
          }],
        };
      }
      if (/UPDATE bookings/.test(sql)) return { rows: [{ id: 42, status: 'cancelled' }] };
      if (/INSERT INTO email_outbox/.test(sql)) return { rows: [{ id: queries.length }] };
      return { rowCount: 1, rows: [] };
    },
    release() {},
  };
  pool.connect = async () => client;
  const res = response();

  await cancelBookingHandler({
    user: { id: 7, role: 'client' },
    params: { id: '42' },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.booking.status, 'cancelled');
  assert.equal(queries.filter(({ sql }) => /INSERT INTO email_outbox/.test(sql)).length, 2);
  assert.equal(queries.at(-1).sql, 'COMMIT');
});

test('legacy booking cancellation rolls back when email intent cannot be queued', async () => {
  const queries = [];
  const client = {
    async query(sql) {
      queries.push(sql);
      if (/SELECT b\.\*/.test(sql)) {
        return {
          rows: [{
            id: 42,
            user_id: 7,
            date: '2026-08-28',
            time: '10:00:00',
            client_email: 'client@example.test',
            therapist_email: 'therapist@example.test',
          }],
        };
      }
      if (/UPDATE bookings/.test(sql)) return { rows: [{ id: 42, status: 'cancelled' }] };
      if (/INSERT INTO email_outbox/.test(sql)) throw new Error('outbox unavailable');
      return { rowCount: 1, rows: [] };
    },
    release() {},
  };
  pool.connect = async () => client;
  const res = response();

  await cancelBookingHandler({
    user: { id: 7, role: 'client' },
    params: { id: '42' },
  }, res);

  assert.equal(res.statusCode, 500);
  assert.equal(queries.at(-1), 'ROLLBACK');
});
