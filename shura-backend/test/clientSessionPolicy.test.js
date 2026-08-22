const test = require('node:test');
const assert = require('node:assert/strict');
const {
  categoryForSession,
  normalizePolicies,
  normalizeSessionStatus,
  sessionActions,
  validateCancellationReason,
  validateReview,
} = require('../utils/clientSessionPolicy');

const now = new Date('2026-08-08T10:00:00.000Z');

test('opens joining exactly ten minutes before an active session', () => {
  const before = sessionActions({ scheduledAt: '2026-08-08T10:10:01.000Z', durationMinutes: 50, status: 'confirmed' }, {}, now);
  assert.equal(before.canJoin, false);
  const open = sessionActions({ scheduledAt: '2026-08-08T10:10:00.000Z', durationMinutes: 50, status: 'confirmed' }, {}, now);
  assert.equal(open.canJoin, true);
});

test('enforces rescheduling and refund cutoffs independently', () => {
  const actions = sessionActions({ scheduledAt: '2026-08-09T09:00:00.000Z', status: 'confirmed', paid: true }, { rescheduleCutoffHours: 24, cancellationCutoffHours: 12 }, now);
  assert.equal(actions.canReschedule, false);
  assert.equal(actions.canCancel, true);
  assert.equal(actions.refundEligible, true);
});

test('never exposes join or mutation actions for cancelled sessions', () => {
  const actions = sessionActions({ scheduledAt: '2026-08-09T10:00:00.000Z', status: 'cancelled', paid: true }, {}, now);
  assert.equal(actions.canJoin, false);
  assert.equal(actions.canReschedule, false);
  assert.equal(actions.canCancel, false);
  assert.equal(actions.refundEligible, false);
});

test('applies canonical payment and refund gating to video join availability', () => {
  const unpaid = sessionActions({
    scheduledAt: '2026-08-08T10:10:00.000Z',
    durationMinutes: 50,
    sessionType: 'video',
    status: 'confirmed',
    paymentKind: 'paid',
    paymentStatus: 'created',
    refundStatus: null,
    hasPaidPayment: false,
  }, {}, now);
  assert.equal(unpaid.canJoin, false);

  const refunded = sessionActions({
    scheduledAt: '2026-08-08T10:10:00.000Z',
    durationMinutes: 50,
    sessionType: 'video',
    status: 'confirmed',
    paymentKind: 'paid',
    paymentStatus: 'refunded',
    refundStatus: 'processed',
    hasPaidPayment: true,
  }, {}, now);
  assert.equal(refunded.canJoin, false);
});

test('allows text session join action when inside join window', () => {
  const actions = sessionActions({
    scheduledAt: '2026-08-08T10:10:00.000Z',
    durationMinutes: 50,
    sessionType: 'text',
    status: 'confirmed',
  }, {}, now);
  assert.equal(actions.canJoin, true);
});

test('normalizes legacy no-show values and categorizes sessions', () => {
  assert.equal(normalizeSessionStatus('no-show'), 'no_show_client');
  assert.equal(categoryForSession({ status: 'no-show', scheduledAt: '2026-08-01T10:00:00Z' }, now), 'past');
  assert.equal(categoryForSession({ status: 'cancelled', scheduledAt: '2026-08-09T10:00:00Z' }, now), 'cancelled');
});

test('validates review and cancellation input limits', () => {
  assert.ok(validateReview({ rating: 0 }).errors.rating);
  assert.deepEqual(validateReview({ rating: 5, comment: ' Helpful ' }).values, { rating: 5, comment: 'Helpful' });
  assert.ok(validateCancellationReason('x'.repeat(1001)).error);
});

test('uses safe policy defaults for missing configuration', () => {
  const policies = normalizePolicies({});
  assert.equal(policies.joinWindowMinutes, 10);
  assert.equal(policies.rescheduleCutoffHours, 24);
  assert.match(policies.cancellationPolicyText, /non-refundable/i);
});
