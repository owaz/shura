const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateVideoJoinPredicate } = require('../utils/videoJoinPolicy');

const base = Object.freeze({
  role: 'client',
  bookingStatus: 'confirmed',
  sessionType: 'video',
  paymentKind: 'paid',
  hasPaidPayment: true,
  refundBlocked: false,
  scheduledAt: '2026-08-22T10:00:00.000Z',
  durationMinutes: 50,
  videoStatus: 'ready',
  participantPreviouslyJoined: false,
});

test('allows client join exactly at open boundary', () => {
  const result = evaluateVideoJoinPredicate({
    ...base,
    now: '2026-08-22T09:50:00.000Z',
  });
  assert.equal(result.allowed, true);
});

test('allows therapist join exactly 20 minutes before start', () => {
  const result = evaluateVideoJoinPredicate({
    ...base,
    role: 'therapist',
    now: '2026-08-22T09:40:00.000Z',
  });
  assert.equal(result.allowed, true);
});

test('rejects text sessions for secure token issuance', () => {
  const result = evaluateVideoJoinPredicate({
    ...base,
    sessionType: 'text',
    now: '2026-08-22T09:55:00.000Z',
  });
  assert.equal(result.allowed, false);
  assert.equal(result.code, 'SESSION_TYPE_UNSUPPORTED');
});

test('rejects missing scheduled_at explicitly', () => {
  const result = evaluateVideoJoinPredicate({
    ...base,
    scheduledAt: null,
    now: '2026-08-22T09:55:00.000Z',
  });
  assert.equal(result.allowed, false);
  assert.equal(result.code, 'SESSION_TIME_MISSING');
  assert.equal(result.httpStatus, 422);
});

test('enforces payment eligibility and refund blocking', () => {
  const notPaid = evaluateVideoJoinPredicate({
    ...base,
    paymentKind: 'paid',
    hasPaidPayment: false,
    now: '2026-08-22T09:55:00.000Z',
  });
  assert.equal(notPaid.allowed, false);
  assert.equal(notPaid.code, 'SESSION_PAYMENT_NOT_ELIGIBLE');

  const refundBlocked = evaluateVideoJoinPredicate({
    ...base,
    refundBlocked: true,
    now: '2026-08-22T09:55:00.000Z',
  });
  assert.equal(refundBlocked.allowed, false);
  assert.equal(refundBlocked.code, 'SESSION_REFUND_BLOCKED');
});

test('allows reconnect only when participant previously joined', () => {
  const reconnectAllowed = evaluateVideoJoinPredicate({
    ...base,
    participantPreviouslyJoined: true,
    now: '2026-08-22T10:55:00.000Z',
  });
  assert.equal(reconnectAllowed.allowed, true);

  const reconnectDenied = evaluateVideoJoinPredicate({
    ...base,
    participantPreviouslyJoined: false,
    now: '2026-08-22T10:55:00.000Z',
  });
  assert.equal(reconnectDenied.allowed, false);
  assert.equal(reconnectDenied.code, 'SESSION_ENDED');
});
