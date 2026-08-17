const crypto = require('crypto');

const SESSION_TYPES = Object.freeze(['video', 'audio', 'text']);
const SESSION_DURATIONS = Object.freeze([30, 50, 80]);

const isIanaTimezone = (value) => {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
};

const validateDateRange = (fromValue, toValue, maxDays = 31) => {
  const from = String(fromValue || '');
  const to = String(toValue || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null;
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  if (start.toISOString().slice(0, 10) !== from || end.toISOString().slice(0, 10) !== to) return null;
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  if (!Number.isInteger(days) || days < 0 || days > maxDays) return null;
  return { from, to };
};

const calculateDurationPrice = (rate60Minutes, durationMinutes) => {
  const rate = Number(rate60Minutes);
  const duration = Number(durationMinutes);
  if (!Number.isFinite(rate) || rate < 0 || !SESSION_DURATIONS.includes(duration)) return null;
  return Math.round((rate * duration * 100) / 60);
};

const paymentTerms = ({ paymentEnabled, sessionsCovered, rate60Minutes, durationMinutes }) => {
  const amountMinor = calculateDurationPrice(rate60Minutes, durationMinutes);
  if (amountMinor === null) return null;
  if (sessionsCovered) return { kind: 'covered', amountMinor: 0, currency: 'INR', paymentRequired: false };
  if (!paymentEnabled || amountMinor === 0) return { kind: 'free', amountMinor: 0, currency: 'INR', paymentRequired: false };
  return { kind: 'paid', amountMinor, currency: 'INR', paymentRequired: true };
};

const validateBookingSelection = (payload, offering = {}) => {
  const therapistId = Number(payload?.therapistId);
  const sessionType = String(payload?.sessionType || '').toLowerCase();
  const durationMinutes = Number(payload?.durationMinutes);
  const scheduledAt = new Date(payload?.scheduledAt);
  const errors = {};
  if (!Number.isInteger(therapistId) || therapistId <= 0) errors.therapistId = 'Choose a valid therapist.';
  if (!SESSION_TYPES.includes(sessionType)) errors.sessionType = 'Choose video, audio, or text.';
  if (!SESSION_DURATIONS.includes(durationMinutes)) errors.durationMinutes = 'Choose a 30, 50, or 80 minute session.';
  if (!payload?.scheduledAt || Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
    errors.scheduledAt = 'Choose a valid future time.';
  }
  if (Array.isArray(offering.sessionTypes) && !offering.sessionTypes.includes(sessionType)) {
    errors.sessionType = 'This therapist does not offer that session type.';
  }
  if (Array.isArray(offering.durationOptions) && !offering.durationOptions.includes(durationMinutes)) {
    errors.durationMinutes = 'This therapist does not offer that session duration.';
  }
  return {
    errors,
    values: Object.keys(errors).length ? null : {
      therapistId,
      sessionType,
      durationMinutes,
      scheduledAt: scheduledAt.toISOString(),
    },
  };
};

const verifyRazorpaySignature = ({ orderId, paymentId, signature, secret }) => {
  if (![orderId, paymentId, signature, secret].every((value) => typeof value === 'string' && value.length > 0)) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
};

module.exports = {
  SESSION_DURATIONS,
  SESSION_TYPES,
  calculateDurationPrice,
  isIanaTimezone,
  paymentTerms,
  verifyRazorpaySignature,
  validateBookingSelection,
  validateDateRange,
};
