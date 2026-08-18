const test = require('node:test');
const assert = require('node:assert/strict');
const {
  billingMode,
  billingRecordId,
  normalizedBillingStatus,
  parseReceiptId,
  receiptAvailable,
  transactionReference,
} = require('../utils/clientBilling');
const { generateReceiptPdf } = require('../services/clientReceiptPdf');

test('selects paid, covered, free, and disabled billing modes', () => {
  assert.equal(billingMode({ billingEnabled: false, paymentEnabled: true, sessionsCovered: false }), 'disabled');
  assert.equal(billingMode({ billingEnabled: true, paymentEnabled: true, sessionsCovered: true }), 'covered');
  assert.equal(billingMode({ billingEnabled: true, paymentEnabled: false, sessionsCovered: false }), 'free');
  assert.equal(billingMode({ billingEnabled: true, paymentEnabled: true, sessionsCovered: false }), 'paid');
});

test('keeps payment and refund states distinct', () => {
  assert.equal(normalizedBillingStatus({ status: 'completed' }), 'paid');
  assert.equal(normalizedBillingStatus({ status: 'failed' }), 'failed');
  assert.equal(normalizedBillingStatus({ status: 'completed', refundStatus: 'pending' }), 'refund_pending');
  assert.equal(normalizedBillingStatus({ status: 'completed', refundStatus: 'failed' }), 'refund_failed');
  assert.equal(normalizedBillingStatus({ status: 'conflict', refundStatus: 'required' }), 'refund_required');
  assert.equal(normalizedBillingStatus({ status: 'refunded' }), 'refunded');
});

test('uses stable typed receipt ids and references', () => {
  assert.deepEqual(parseReceiptId('payment-42'), { source: 'payment', id: 42 });
  assert.deepEqual(parseReceiptId('intent-7'), { source: 'intent', id: 7 });
  assert.equal(parseReceiptId('payment-0'), null);
  assert.equal(parseReceiptId('../payment-42'), null);
  assert.equal(billingRecordId('payment', 42), 'payment-42');
  assert.equal(transactionReference('payment', 42), 'SHURA-PAY-000042');
});

test('only offers receipts for captured payment records', () => {
  assert.equal(receiptAvailable({ source: 'payment', status: 'paid' }), true);
  assert.equal(receiptAvailable({ source: 'payment', status: 'pending' }), false);
  assert.equal(receiptAvailable({ source: 'intent', status: 'refund_required', providerPaymentPresent: true }), true);
  assert.equal(receiptAvailable({ source: 'intent', status: 'refund_required', providerPaymentPresent: false }), false);
});

test('generates a branded PDF from payment and appointment metadata', async () => {
  const pdf = await generateReceiptPdf({
    reference: 'SHURA-PAY-000042',
    amountMinor: 125000,
    currency: 'INR',
    statusLabel: 'Paid',
    transactionDate: '2026-08-18T12:00:00.000Z',
    refundStatusLabel: null,
    refundAmountMinor: 0,
    therapistName: 'Dr Example',
    scheduledAt: '2026-08-20T12:00:00.000Z',
    clientTimezone: 'Asia/Dubai',
    sessionTypeLabel: 'Video session',
    durationMinutes: 50,
  });
  assert.ok(Buffer.isBuffer(pdf));
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.ok(pdf.length > 1_000);
});
