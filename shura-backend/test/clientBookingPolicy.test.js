const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
  calculateDurationPrice,
  isIanaTimezone,
  paymentTerms,
  verifyRazorpaySignature,
  validateBookingSelection,
  validateDateRange,
} = require('../utils/clientBookingPolicy');

test('derives portal duration prices entirely from the 60-minute rate', () => {
  assert.equal(calculateDurationPrice(1200, 30), 60000);
  assert.equal(calculateDurationPrice(1200, 50), 100000);
  assert.equal(calculateDurationPrice(1200, 80), 160000);
  assert.equal(calculateDurationPrice(1200, 60), null);
});

test('selects paid, covered, and free booking terms without a browser amount', () => {
  assert.deepEqual(paymentTerms({ paymentEnabled: true, sessionsCovered: false, rate60Minutes: 1200, durationMinutes: 50 }), {
    kind: 'paid', amountMinor: 100000, currency: 'INR', paymentRequired: true,
  });
  assert.equal(paymentTerms({ paymentEnabled: true, sessionsCovered: true, rate60Minutes: 1200, durationMinutes: 50 }).kind, 'covered');
  assert.equal(paymentTerms({ paymentEnabled: false, sessionsCovered: false, rate60Minutes: 1200, durationMinutes: 50 }).kind, 'free');
});

test('validates therapist offerings and future timestamp selections', () => {
  const valid = validateBookingSelection({
    therapistId: 7,
    sessionType: 'audio',
    durationMinutes: 50,
    scheduledAt: '2099-08-20T09:00:00.000Z',
    amountMinor: 1,
  }, { sessionTypes: ['video', 'audio'], durationOptions: [50, 80] });
  assert.deepEqual(valid.errors, {});
  assert.equal(valid.values.durationMinutes, 50);

  const invalid = validateBookingSelection({ therapistId: 7, sessionType: 'text', durationMinutes: 30, scheduledAt: '2020-01-01' }, {
    sessionTypes: ['video'], durationOptions: [50],
  });
  assert.ok(invalid.errors.sessionType);
  assert.ok(invalid.errors.durationMinutes);
  assert.ok(invalid.errors.scheduledAt);
});

test('validates IANA timezones and bounded availability ranges', () => {
  assert.equal(isIanaTimezone('Asia/Dubai'), true);
  assert.equal(isIanaTimezone('Mars/Olympus'), false);
  assert.deepEqual(validateDateRange('2026-08-15', '2026-09-14'), { from: '2026-08-15', to: '2026-09-14' });
  assert.equal(validateDateRange('2026-08-15', '2026-09-16'), null);
  assert.equal(validateDateRange('2026-02-30', '2026-03-01'), null);
});

test('accepts only the matching Razorpay order/payment signature', () => {
  const secret = 'test-secret';
  const signature = crypto.createHmac('sha256', secret).update('order_1|pay_1').digest('hex');
  assert.equal(verifyRazorpaySignature({ orderId: 'order_1', paymentId: 'pay_1', signature, secret }), true);
  assert.equal(verifyRazorpaySignature({ orderId: 'order_1', paymentId: 'pay_2', signature, secret }), false);
  assert.equal(verifyRazorpaySignature({ orderId: 'order_1', paymentId: 'pay_1', signature: 'short', secret }), false);
});
