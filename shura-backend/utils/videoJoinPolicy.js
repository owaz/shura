const JOIN_OPEN_MINUTES = Object.freeze({
  client: 10,
  therapist: 20,
});

const RECONNECT_GRACE_MINUTES = 10;
const HARD_END_GRACE_MINUTES = 15;

const JOINABLE_BOOKING_STATUSES = new Set(['confirmed', 'upcoming', 'live']);
const JOINABLE_SESSION_TYPES = new Set(['video', 'audio']);
const TERMINAL_VIDEO_STATUSES = new Set(['ended', 'cancelled', 'expired']);
const PAYMENT_ELIGIBLE_KINDS = new Set(['free', 'covered']);

const normalizeLower = (value) => String(value || '').trim().toLowerCase();

const parseUtcInstant = (value) => {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const parseDurationMinutes = (value) => {
  const duration = Number(value);
  if (!Number.isFinite(duration) || duration <= 0) return null;
  return duration;
};

const buildJoinWindow = ({ scheduledAt, durationMinutes, role }) => {
  const normalizedRole = normalizeLower(role);
  if (!Object.prototype.hasOwnProperty.call(JOIN_OPEN_MINUTES, normalizedRole)) {
    return null;
  }

  const start = parseUtcInstant(scheduledAt);
  const duration = parseDurationMinutes(durationMinutes);
  if (!start || duration === null) return null;

  const scheduledEnd = new Date(start.getTime() + (duration * 60_000));
  const opensAt = new Date(start.getTime() - (JOIN_OPEN_MINUTES[normalizedRole] * 60_000));
  const reconnectUntil = new Date(scheduledEnd.getTime() + (RECONNECT_GRACE_MINUTES * 60_000));
  const hardEndsAt = new Date(scheduledEnd.getTime() + (HARD_END_GRACE_MINUTES * 60_000));

  return {
    start,
    scheduledEnd,
    opensAt,
    reconnectUntil,
    hardEndsAt,
  };
};

const serializeJoinWindow = (window) => ({
  opensAt: window.opensAt.toISOString(),
  closesAt: window.scheduledEnd.toISOString(),
  reconnectUntil: window.reconnectUntil.toISOString(),
  hardEndsAt: window.hardEndsAt.toISOString(),
});

const deny = (httpStatus, code, message, joinWindow) => ({
  allowed: false,
  httpStatus,
  code,
  message,
  details: joinWindow ? { join: serializeJoinWindow(joinWindow) } : null,
});

const allow = (joinWindow) => ({
  allowed: true,
  details: { join: serializeJoinWindow(joinWindow) },
});

const evaluateVideoJoinPredicate = ({
  role,
  bookingStatus,
  sessionType,
  paymentKind,
  hasPaidPayment = false,
  refundBlocked = false,
  scheduledAt,
  durationMinutes,
  videoStatus,
  participantPreviouslyJoined = false,
  now = new Date(),
}) => {
  const normalizedRole = normalizeLower(role);
  if (!Object.prototype.hasOwnProperty.call(JOIN_OPEN_MINUTES, normalizedRole)) {
    return deny(403, 'SESSION_ACCESS_DENIED', 'You do not have access to this session.');
  }

  const normalizedSessionType = normalizeLower(sessionType);
  if (!JOINABLE_SESSION_TYPES.has(normalizedSessionType)) {
    return deny(
      409,
      'SESSION_TYPE_UNSUPPORTED',
      'Only video and audio sessions can be joined through secure calling.'
    );
  }

  if (!scheduledAt) {
    return deny(
      422,
      'SESSION_TIME_MISSING',
      'This session is missing a scheduled time and cannot be joined yet.'
    );
  }

  const joinWindow = buildJoinWindow({ scheduledAt, durationMinutes, role: normalizedRole });
  if (!joinWindow) {
    return deny(
      422,
      'SESSION_TIME_MISSING',
      'This session is missing a valid schedule and cannot be joined yet.'
    );
  }

  const normalizedBookingStatus = normalizeLower(bookingStatus);
  if (normalizedBookingStatus === 'cancelled') {
    return deny(409, 'SESSION_CANCELLED', 'This session has been cancelled.', joinWindow);
  }
  if (!JOINABLE_BOOKING_STATUSES.has(normalizedBookingStatus)) {
    return deny(
      409,
      'SESSION_NOT_CONFIRMED',
      'This session is not in a joinable state.',
      joinWindow
    );
  }

  const normalizedPaymentKind = normalizeLower(paymentKind);
  const paymentEligible = PAYMENT_ELIGIBLE_KINDS.has(normalizedPaymentKind) || Boolean(hasPaidPayment);
  if (!paymentEligible) {
    return deny(
      409,
      'SESSION_PAYMENT_NOT_ELIGIBLE',
      'Payment must be completed before joining this session.',
      joinWindow
    );
  }

  if (refundBlocked) {
    return deny(
      409,
      'SESSION_REFUND_BLOCKED',
      'This session is blocked because a refund has started or completed.',
      joinWindow
    );
  }

  if (TERMINAL_VIDEO_STATUSES.has(normalizeLower(videoStatus))) {
    return deny(409, 'SESSION_ENDED', 'This session has already ended.', joinWindow);
  }

  const nowInstant = parseUtcInstant(now);
  if (!nowInstant) {
    return deny(500, 'SESSION_JOIN_FAILED', 'We could not evaluate session joining right now.', joinWindow);
  }

  if (nowInstant > joinWindow.hardEndsAt) {
    return deny(409, 'SESSION_ENDED', 'This session has already ended.', joinWindow);
  }

  if (nowInstant >= joinWindow.opensAt && nowInstant <= joinWindow.scheduledEnd) {
    return allow(joinWindow);
  }

  if (
    Boolean(participantPreviouslyJoined)
    && nowInstant > joinWindow.scheduledEnd
    && nowInstant <= joinWindow.reconnectUntil
  ) {
    return allow(joinWindow);
  }

  if (nowInstant < joinWindow.opensAt) {
    return deny(409, 'SESSION_NOT_OPEN', 'This session is not open for joining yet.', joinWindow);
  }

  return deny(409, 'SESSION_ENDED', 'This session has already ended.', joinWindow);
};

module.exports = {
  HARD_END_GRACE_MINUTES,
  JOIN_OPEN_MINUTES,
  JOINABLE_BOOKING_STATUSES,
  JOINABLE_SESSION_TYPES,
  PAYMENT_ELIGIBLE_KINDS,
  RECONNECT_GRACE_MINUTES,
  TERMINAL_VIDEO_STATUSES,
  buildJoinWindow,
  evaluateVideoJoinPredicate,
};
