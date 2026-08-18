const receiptIdPattern = /^(payment|intent)-([1-9]\d*)$/;
const maxReceiptNumericId = '2147483647';

const billingMode = ({ billingEnabled, paymentEnabled, sessionsCovered }) => {
  if (billingEnabled !== true) return 'disabled';
  if (sessionsCovered) return 'covered';
  if (paymentEnabled === false) return 'free';
  return 'paid';
};

const normalizedBillingStatus = ({ status, refundStatus, requiresRefund = false }) => {
  const normalizedRefund = String(refundStatus || '').trim().toLowerCase();
  if (normalizedRefund === 'completed' || normalizedRefund === 'processed') return 'refunded';
  if (normalizedRefund === 'pending') return 'refund_pending';
  if (normalizedRefund === 'failed') return 'refund_failed';
  if (normalizedRefund === 'required' || requiresRefund) return 'refund_required';

  const normalized = String(status || '').trim().toLowerCase();
  if (['completed', 'success', 'paid', 'captured'].includes(normalized)) return 'paid';
  if (normalized === 'refunded') return 'refunded';
  if (normalized === 'failed') return 'failed';
  return 'pending';
};

const receiptAvailable = ({ source, status, providerPaymentPresent = false }) => {
  const charged = new Set(['paid', 'refunded', 'refund_pending', 'refund_failed', 'refund_required']);
  const normalized = typeof status === 'object'
    ? normalizedBillingStatus(status)
    : charged.has(status) ? status : normalizedBillingStatus({ status });
  if (!charged.has(normalized)) return false;
  return source === 'payment' || (source === 'intent' && providerPaymentPresent);
};

const parseReceiptId = (value) => {
  const match = receiptIdPattern.exec(String(value || ''));
  if (!match) return null;
  const id = match[2];
  if (id.length > maxReceiptNumericId.length || (id.length === maxReceiptNumericId.length && id > maxReceiptNumericId)) {
    return null;
  }
  return { source: match[1], id: Number(id) };
};

const billingRecordId = (source, id) => `${source}-${id}`;

const transactionReference = (source, id) =>
  `SHURA-${source === 'payment' ? 'PAY' : 'INT'}-${String(id).padStart(6, '0')}`;

const statusLabel = (status) => ({
  paid: 'Paid',
  pending: 'Pending',
  failed: 'Failed',
  refunded: 'Refunded',
  refund_required: 'Refund required',
  refund_pending: 'Refund pending',
  refund_failed: 'Refund failed',
}[status] || 'Pending');

module.exports = {
  billingMode,
  billingRecordId,
  normalizedBillingStatus,
  parseReceiptId,
  receiptAvailable,
  statusLabel,
  transactionReference,
};
