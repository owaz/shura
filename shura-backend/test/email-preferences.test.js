const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../db');
const {
  sendBookingConfirmation,
  sendQuestionnaireAdminNotification,
} = require('../utils/emailService');

const booking = {
  bookingId: 42,
  clientId: 7,
  clientName: 'Client',
  clientEmail: 'client@example.com',
  therapistName: 'Therapist',
  sessionType: 'video',
  date: '2026-08-20',
  time: '10:00',
};

const originalQuery = pool.query;

test.beforeEach(() => {
  process.env.RESEND_FROM_EMAIL = 'sender@notify.example.com';
  process.env.ADMIN_EMAIL = 'admin@example.com';
});

test.afterEach(() => {
  pool.query = originalQuery;
  delete process.env.RESEND_FROM_EMAIL;
  delete process.env.ADMIN_EMAIL;
});

test('skips booking confirmation when the client has opted out', async () => {
  let queryCount = 0;
  pool.query = async () => {
    queryCount += 1;
    return { rows: [{ notification_booking_confirmation: false }] };
  };

  const result = await sendBookingConfirmation(booking);

  assert.deepEqual(result, { success: true, skipped: true });
  assert.equal(queryCount, 1);
});

test('queues booking confirmation when the client is opted in', async () => {
  const queries = [];
  pool.query = async (sql, params) => {
    queries.push({ sql, params });
    if (queries.length === 1) {
      return { rows: [{ notification_booking_confirmation: true }] };
    }
    return { rows: [{ id: 1 }] };
  };

  const result = await sendBookingConfirmation(booking);

  assert.equal(result.success, true);
  assert.equal(result.queued, true);
  assert.equal(queries[1].params[0], 'booking-confirmation:42');
  assert.equal(queries[1].params[1], 'booking_confirmation');
  assert.equal(queries[1].params[2], booking.clientEmail);
  assert.equal(queries[1].params[3], process.env.RESEND_FROM_EMAIL);
  assert.match(queries[1].params[6], /Your session with Therapist is booked/);
});

test('fails closed when the booking client cannot be found', async () => {
  pool.query = async () => ({ rows: [] });

  const result = await sendBookingConfirmation(booking);

  assert.deepEqual(result, { success: false, error: 'Booking confirmation client was not found' });
});

test('returns the database error and does not enqueue when preference lookup fails', async () => {
  pool.query = async () => { throw new Error('database unavailable'); };

  const result = await sendBookingConfirmation(booking);

  assert.deepEqual(result, { success: false, error: 'database unavailable' });
});

test('requires client identity for booking confirmation preference enforcement', async () => {
  const result = await sendBookingConfirmation({ ...booking, clientId: undefined });
  assert.deepEqual(result, {
    success: false,
    error: 'clientId is required for booking confirmation emails',
  });
});

test('queues a minimal questionnaire alert with an opaque event key', async () => {
  let params;
  pool.query = async (_sql, values) => {
    params = values;
    return { rows: [{ id: 1 }] };
  };

  const result = await sendQuestionnaireAdminNotification({
    userId: 7,
    email: 'client@example.com',
    concerns: ['synthetic concern'],
    additionalNotes: 'synthetic sensitive note',
  });

  assert.equal(result.success, true);
  assert.equal(params[0], 'questionnaire-submission:7');
  assert.equal(params[1], 'questionnaire_submission');
  assert.doesNotMatch(params[0], /@|https?:\/\//);
  assert.doesNotMatch(params[5], /client@example\.com|synthetic concern|synthetic sensitive note/);
  assert.doesNotMatch(params[6], /client@example\.com|synthetic concern|synthetic sensitive note/);
});
