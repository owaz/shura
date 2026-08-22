const UPCOMING_STATUSES = new Set(['pending', 'confirmed', 'upcoming', 'live']);
const PAST_STATUSES = new Set(['completed', 'no_show_client', 'no_show_therapist', 'no-show']);
const {
  JOINABLE_BOOKING_STATUSES,
  JOINABLE_SESSION_TYPES,
  buildJoinWindow,
} = require('./videoJoinPolicy');

const defaultPolicies = Object.freeze({
  joinWindowMinutes: 10,
  rescheduleCutoffHours: 24,
  cancellationCutoffHours: 24,
  cancellationPolicyText: 'Cancellations within 24 hours of the session are non-refundable.',
});

const policyNumber = (value, fallback) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : fallback;

const normalizePolicies = (value = {}) => ({
  joinWindowMinutes: policyNumber(value.joinWindowMinutes, defaultPolicies.joinWindowMinutes),
  rescheduleCutoffHours: policyNumber(value.rescheduleCutoffHours, defaultPolicies.rescheduleCutoffHours),
  cancellationCutoffHours: policyNumber(value.cancellationCutoffHours, defaultPolicies.cancellationCutoffHours),
  cancellationPolicyText: String(value.cancellationPolicyText || defaultPolicies.cancellationPolicyText),
});

const normalizeSessionStatus = (status) => {
  const normalized = String(status || '').trim().toLowerCase().replace(/-/g, '_');
  if (normalized === 'no_show') return 'no_show_client';
  if (normalized === 'success') return 'completed';
  return normalized || 'pending';
};

const hoursUntil = (scheduledAt, now = new Date()) =>
  (new Date(scheduledAt).getTime() - now.getTime()) / 3_600_000;

const sessionActions = (
  {
    scheduledAt,
    durationMinutes = 50,
    status,
    paid = false,
    sessionType = 'video',
  },
  policies,
  now = new Date()
) => {
  const policy = normalizePolicies(policies);
  const normalizedStatus = normalizeSessionStatus(status);
  const normalizedSessionType = String(sessionType || '').trim().toLowerCase();
  const start = new Date(scheduledAt);
  const end = new Date(start.getTime() + Number(durationMinutes || 50) * 60_000);
  const joinWindow = buildJoinWindow({ scheduledAt, durationMinutes, role: 'client' });
  const active = UPCOMING_STATUSES.has(normalizedStatus);
  const joinableStatus = JOINABLE_BOOKING_STATUSES.has(normalizedStatus);
  const joinableMode = JOINABLE_SESSION_TYPES.has(normalizedSessionType);
  const remainingHours = hoursUntil(start, now);
  return {
    canJoin: joinableStatus
      && joinableMode
      && Boolean(joinWindow)
      && now >= joinWindow.opensAt
      && now <= joinWindow.scheduledEnd,
    joinAvailableAt: joinWindow ? joinWindow.opensAt.toISOString() : null,
    canReschedule: active && remainingHours >= policy.rescheduleCutoffHours,
    canCancel: active && now < end,
    refundEligible: active && paid && remainingHours >= policy.cancellationCutoffHours,
    rescheduleCutoffHours: policy.rescheduleCutoffHours,
    cancellationCutoffHours: policy.cancellationCutoffHours,
    cancellationPolicyText: policy.cancellationPolicyText,
  };
};

const categoryForSession = ({ status, scheduledAt, durationMinutes = 50 }, now = new Date()) => {
  const normalized = normalizeSessionStatus(status);
  if (normalized === 'cancelled') return 'cancelled';
  if (PAST_STATUSES.has(normalized)) return 'past';
  const end = new Date(new Date(scheduledAt).getTime() + Number(durationMinutes || 50) * 60_000);
  return UPCOMING_STATUSES.has(normalized) && end >= now ? 'upcoming' : 'past';
};

const validateReview = (payload = {}) => {
  const rating = Number(payload.rating);
  const comment = typeof payload.comment === 'string' ? payload.comment.trim() : '';
  const errors = {};
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) errors.rating = 'Choose a rating from 1 to 5.';
  if (comment.length > 1000) errors.comment = 'Keep your review to 1,000 characters or fewer.';
  return { errors, values: { rating, comment: comment || null } };
};

const validateCancellationReason = (value) => {
  const reason = typeof value === 'string' ? value.trim() : '';
  if (reason.length > 1000) return { error: 'Keep the cancellation reason to 1,000 characters or fewer.' };
  return { value: reason || null };
};

module.exports = {
  PAST_STATUSES,
  UPCOMING_STATUSES,
  categoryForSession,
  defaultPolicies,
  normalizePolicies,
  normalizeSessionStatus,
  sessionActions,
  validateCancellationReason,
  validateReview,
};
