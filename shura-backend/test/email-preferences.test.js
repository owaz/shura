const test = require('node:test');
const assert = require('node:assert/strict');
const nodemailer = require('nodemailer');
const pool = require('../db');
const { sendBookingConfirmation } = require('../utils/emailService');

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
const originalCreateTransport = nodemailer.createTransport;

test.beforeEach(() => {
  delete process.env.RESEND_API_KEY;
  process.env.EMAIL_USER = 'sender@example.com';
  process.env.EMAIL_PASSWORD = 'password';
});

test.afterEach(() => {
  pool.query = originalQuery;
  nodemailer.createTransport = originalCreateTransport;
});

test('skips booking confirmation when the client has opted out', async () => {
  let sendCount = 0;
  pool.query = async () => ({ rows: [{ notification_booking_confirmation: false }] });
  nodemailer.createTransport = () => ({
    sendMail: async () => { sendCount += 1; },
  });

  const result = await sendBookingConfirmation(booking);

  assert.deepEqual(result, { success: true, skipped: true });
  assert.equal(sendCount, 0);
});

test('sends booking confirmation when the client is opted in', async () => {
  let sentMail;
  pool.query = async () => ({ rows: [{ notification_booking_confirmation: true }] });
  nodemailer.createTransport = () => ({
    sendMail: async (mail) => { sentMail = mail; },
  });

  const result = await sendBookingConfirmation(booking);

  assert.equal(result.success, true);
  assert.equal(sentMail.to, booking.clientEmail);
  assert.equal(sentMail.idempotencyKey, 'booking-confirmation:42');
});

test('fails closed when the booking client cannot be found', async () => {
  let sendCount = 0;
  pool.query = async () => ({ rows: [] });
  nodemailer.createTransport = () => ({
    sendMail: async () => { sendCount += 1; },
  });

  const result = await sendBookingConfirmation(booking);

  assert.deepEqual(result, { success: false, error: 'Booking confirmation client was not found' });
  assert.equal(sendCount, 0);
});

test('returns the database error and does not send when preference lookup fails', async () => {
  let sendCount = 0;
  pool.query = async () => { throw new Error('database unavailable'); };
  nodemailer.createTransport = () => ({
    sendMail: async () => { sendCount += 1; },
  });

  const result = await sendBookingConfirmation(booking);

  assert.deepEqual(result, { success: false, error: 'database unavailable' });
  assert.equal(sendCount, 0);
});

test('requires client identity for booking confirmation preference enforcement', async () => {
  const result = await sendBookingConfirmation({ ...booking, clientId: undefined });
  assert.deepEqual(result, {
    success: false,
    error: 'clientId is required for booking confirmation emails',
  });
});
