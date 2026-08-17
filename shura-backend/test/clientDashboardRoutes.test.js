const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../db');
const router = require('../routes/clientDashboard');

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
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.body = payload; return this; },
});

test('notification count is scoped to the authenticated client id', async () => {
  let call;
  pool.query = async (sql, params) => {
    call = { sql, params };
    return { rows: [{ unread_count: 4 }] };
  };
  const res = response();
  await routeHandler('/notifications/count', 'get')({ clientId: 42 }, res);
  assert.equal(res.body.data.unreadCount, 4);
  assert.deepEqual(call.params, [42]);
  assert.match(call.sql, /WHERE client_id = \$1 AND read_at IS NULL/);
});

test('mark-read mutation includes ownership in the update statement', async () => {
  let call;
  pool.query = async (sql, params) => {
    call = { sql, params };
    return { rows: [{ id: '9', read_at: '2026-08-17T00:00:00.000Z' }] };
  };
  const res = response();
  await routeHandler('/notifications/:id/read', 'patch')({ clientId: 42, params: { id: '9' } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(call.params, ['9', 42]);
  assert.match(call.sql, /WHERE id = \$1::bigint AND client_id = \$2/);
});

test('mark-read returns not found when the notification belongs to another client', async () => {
  pool.query = async () => ({ rows: [] });
  const res = response();
  await routeHandler('/notifications/:id/read', 'patch')({ clientId: 42, params: { id: '999' } }, res);
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error.code, 'NOTIFICATION_NOT_FOUND');
});

test('dashboard session mapping preserves the server join window', async () => {
  const scheduledAt = '2099-01-02T12:00:00.000Z';
  const session = await router.mapDashboardSession({
    id: 7,
    therapist_id: 8,
    therapist_name: 'Dr Test',
    therapist_credentials: ['PhD'],
    therapist_image_storage_provider: null,
    therapist_image_blob_name: null,
    therapist_image_url: '',
    scheduled_at: scheduledAt,
    duration_minutes: 50,
    session_type: 'video',
    status: 'confirmed',
    client_timezone: 'Asia/Dubai',
    payment_status: 'completed',
  }, {
    joinWindowMinutes: 10,
    rescheduleCutoffHours: 24,
    cancellationCutoffHours: 24,
  });

  assert.equal(session.actions.joinAvailableAt, '2099-01-02T11:50:00.000Z');
  assert.equal(session.actions.canJoin, false);
  assert.equal(session.clientTimezone, 'Asia/Dubai');
});
