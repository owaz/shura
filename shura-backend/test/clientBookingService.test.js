const test = require('node:test');
const assert = require('node:assert/strict');

const pool = require('../db');
const { finalizePaidBookingIntent } = require('../services/clientBookingService');

const originalConnect = pool.connect;
const originalQuery = pool.query;

test.afterEach(() => {
  pool.connect = originalConnect;
  pool.query = originalQuery;
});

const bookingRow = (overrides = {}) => ({
  id: 10,
  user_id: 5,
  therapist_id: 7,
  scheduled_at: '2099-01-01T10:00:00.000Z',
  duration_minutes: 50,
  session_type: 'video',
  status: 'confirmed',
  payment_kind: 'paid',
  amount_cents: 100000,
  currency: 'INR',
  therapist_name: 'Dr. Test',
  client_timezone: 'UTC',
  ...overrides,
});

const makeClient = (handler) => ({
  query: async (sql, params) => handler(sql, params),
  release: () => {},
});

test('replays an already completed intent instead of re-inserting a booking or payment', async () => {
  const calls = [];
  const client = makeClient(async (sql) => {
    calls.push(sql);
    if (/^BEGIN/.test(sql)) return {};
    if (/FROM payment_booking_intents/.test(sql) && /FOR UPDATE/.test(sql)) {
      return { rows: [{ id: 1, order_id: 'order_replay', client_id: 5, therapist_id: 7, status: 'completed', booking_id: 10 }] };
    }
    if (/FROM bookings b/.test(sql)) {
      return { rows: [bookingRow()] };
    }
    if (/^COMMIT/.test(sql)) return {};
    throw new Error(`Unexpected query: ${sql}`);
  });
  pool.connect = async () => client;

  const result = await finalizePaidBookingIntent({ orderId: 'order_replay', paymentId: 'pay_1' });

  assert.equal(result.status, 'completed');
  assert.equal(result.replayed, true);
  assert.equal(result.booking.id, 10);
  assert.ok(!calls.some((sql) => /INSERT INTO payments/.test(sql)), 'must not insert a duplicate payment');
});

test('reuses an existing payment row for the same order instead of creating a second booking', async () => {
  const calls = [];
  const client = makeClient(async (sql) => {
    calls.push(sql);
    if (/^BEGIN/.test(sql)) return {};
    if (/FROM payment_booking_intents/.test(sql) && /FOR UPDATE/.test(sql)) {
      return { rows: [{ id: 2, order_id: 'order_reuse', client_id: 5, therapist_id: 7, status: 'initiated', booking_id: null }] };
    }
    if (/FROM payments WHERE razorpay_payment_id/.test(sql)) {
      return { rows: [{ id: 99, booking_id: 20, client_id: 5, razorpay_order_id: 'order_reuse' }] };
    }
    if (/FROM bookings b/.test(sql)) {
      return { rows: [bookingRow({ id: 20 })] };
    }
    if (/UPDATE payment_booking_intents SET status = 'completed'/.test(sql)) return {};
    if (/^COMMIT/.test(sql)) return {};
    throw new Error(`Unexpected query: ${sql}`);
  });
  pool.connect = async () => client;

  const result = await finalizePaidBookingIntent({ orderId: 'order_reuse', paymentId: 'pay_2' });

  assert.equal(result.status, 'completed');
  assert.equal(result.replayed, true);
  assert.equal(result.booking.id, 20);
  assert.ok(!calls.some((sql) => /INSERT INTO bookings/.test(sql)), 'must not create a second booking for a reused payment');
});

test('rejects a payment already attributed to a different order/client', async () => {
  const client = makeClient(async (sql) => {
    if (/^BEGIN/.test(sql)) return {};
    if (/FROM payment_booking_intents/.test(sql) && /FOR UPDATE/.test(sql)) {
      return { rows: [{ id: 3, order_id: 'order_owned', client_id: 5, therapist_id: 7, status: 'initiated', booking_id: null }] };
    }
    if (/FROM payments WHERE razorpay_payment_id/.test(sql)) {
      return { rows: [{ id: 100, booking_id: 21, client_id: 999, razorpay_order_id: 'order_other' }] };
    }
    if (/^ROLLBACK/.test(sql)) return {};
    throw new Error(`Unexpected query: ${sql}`);
  });
  pool.connect = async () => client;

  await assert.rejects(
    () => finalizePaidBookingIntent({ orderId: 'order_owned', paymentId: 'pay_3' }),
    (error) => {
      assert.equal(error.code, 'PAYMENT_ALREADY_USED');
      return true;
    }
  );
});

test('does not overwrite an intent that another finalizer already completed while marking a conflict', async () => {
  let connectCount = 0;
  const mainClientCalls = [];
  const conflictClientCalls = [];

  const mainClient = makeClient(async (sql) => {
    mainClientCalls.push(sql);
    if (/^BEGIN/.test(sql)) return {};
    if (/FROM payment_booking_intents/.test(sql) && /FOR UPDATE/.test(sql)) {
      return {
        rows: [{
          id: 4,
          order_id: 'order_race',
          client_id: 5,
          therapist_id: 7,
          status: 'initiated',
          booking_id: null,
          session_type: 'video',
          duration_minutes: 50,
          scheduled_at: '2099-01-01T10:00:00.000Z',
          amount_cents: 100000,
          currency: 'INR',
        }],
      };
    }
    if (/FROM payments WHERE razorpay_payment_id/.test(sql)) return { rows: [] };
    if (/FROM therapist_clients/.test(sql)) {
      return {
        rows: [{
          id: 7,
          full_name: 'Dr. Test',
          session_types: ['audio'],
          session_duration_options: [50],
          rate_60min: 1200,
          client_timezone: 'UTC',
          therapist_timezone: 'UTC',
          sessions_covered: false,
        }],
      };
    }
    if (/platform_settings/.test(sql)) return { rows: [{ setting_value: {} }] };
    if (/^ROLLBACK/.test(sql)) return {};
    throw new Error(`Unexpected main-client query: ${sql}`);
  });

  const conflictClient = makeClient(async (sql) => {
    conflictClientCalls.push(sql);
    if (/^BEGIN/.test(sql)) return {};
    if (/FROM payment_booking_intents/.test(sql) && /FOR UPDATE/.test(sql)) {
      return { rows: [{ id: 4, order_id: 'order_race', client_id: 5, status: 'completed', booking_id: 30 }] };
    }
    if (/^COMMIT/.test(sql)) return {};
    throw new Error(`Unexpected conflict-client query: ${sql}`);
  });

  pool.connect = async () => {
    connectCount += 1;
    return connectCount === 1 ? mainClient : conflictClient;
  };
  pool.query = async (sql) => {
    if (/FROM bookings b/.test(sql)) return { rows: [bookingRow({ id: 30 })] };
    throw new Error(`Unexpected pool query: ${sql}`);
  };

  const result = await finalizePaidBookingIntent({ orderId: 'order_race', paymentId: 'pay_race' });

  assert.equal(result.status, 'completed');
  assert.equal(result.replayed, true);
  assert.equal(result.booking.id, 30);
  assert.ok(
    !conflictClientCalls.some((sql) => /SET status = 'conflict'/.test(sql)),
    'must not overwrite a completed intent as conflict once another finalizer has won'
  );
});

test('persists a conflict when the intent has not been completed by another finalizer', async () => {
  let connectCount = 0;
  const conflictClientCalls = [];

  const mainClient = makeClient(async (sql) => {
    if (/^BEGIN/.test(sql)) return {};
    if (/FROM payment_booking_intents/.test(sql) && /FOR UPDATE/.test(sql)) {
      return {
        rows: [{
          id: 5,
          order_id: 'order_conflict',
          client_id: 5,
          therapist_id: 7,
          status: 'initiated',
          booking_id: null,
          session_type: 'video',
          duration_minutes: 50,
          scheduled_at: '2099-01-01T10:00:00.000Z',
          amount_cents: 100000,
          currency: 'INR',
        }],
      };
    }
    if (/FROM payments WHERE razorpay_payment_id/.test(sql)) return { rows: [] };
    if (/FROM therapist_clients/.test(sql)) {
      return {
        rows: [{
          id: 7,
          full_name: 'Dr. Test',
          session_types: ['audio'],
          session_duration_options: [50],
          rate_60min: 1200,
          client_timezone: 'UTC',
          therapist_timezone: 'UTC',
          sessions_covered: false,
        }],
      };
    }
    if (/platform_settings/.test(sql)) return { rows: [{ setting_value: {} }] };
    if (/^ROLLBACK/.test(sql)) return {};
    throw new Error(`Unexpected main-client query: ${sql}`);
  });

  const conflictClient = makeClient(async (sql) => {
    conflictClientCalls.push(sql);
    if (/^BEGIN/.test(sql)) return {};
    if (/FROM payment_booking_intents/.test(sql) && /FOR UPDATE/.test(sql)) {
      return { rows: [{ id: 5, order_id: 'order_conflict', client_id: 5, status: 'initiated', booking_id: null }] };
    }
    if (/SET status = 'conflict'/.test(sql)) {
      return { rows: [{ id: 5, order_id: 'order_conflict', client_id: 5, status: 'conflict', booking_id: null }] };
    }
    if (/^COMMIT/.test(sql)) return {};
    throw new Error(`Unexpected conflict-client query: ${sql}`);
  });

  pool.connect = async () => {
    connectCount += 1;
    return connectCount === 1 ? mainClient : conflictClient;
  };

  const result = await finalizePaidBookingIntent({ orderId: 'order_conflict', paymentId: 'pay_conflict' });

  assert.equal(result.status, 'conflict');
  assert.equal(result.intent.status, 'conflict');
  assert.ok(conflictClientCalls.some((sql) => /SET status = 'conflict'/.test(sql)));
});
