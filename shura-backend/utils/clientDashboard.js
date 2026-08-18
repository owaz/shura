const MILLISECONDS_PER_DAY = 86_400_000;

const utcDateKey = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const utcDayOrdinal = (value = new Date()) => {
  const key = utcDateKey(value);
  if (!key) return null;
  return Math.floor(new Date(`${key}T00:00:00.000Z`).getTime() / MILLISECONDS_PER_DAY);
};

const quoteIndexForDate = (value, quoteCount) => {
  const count = Number(quoteCount);
  const ordinal = utcDayOrdinal(value);
  if (!Number.isInteger(count) || count <= 0 || ordinal === null) return null;
  return ((ordinal % count) + count) % count;
};

const safeMetadata = (metadata) => (
  metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {}
);

const notificationAction = (type, metadata) => {
  const values = safeMetadata(metadata);
  const normalizedType = String(type || '').toLowerCase();
  const bookingId = Number(values.bookingId);

  if (['session_booked', 'session_rescheduled', 'session_cancelled', 'session_reminder', 'payment_completed', 'refund_pending', 'refund_processed', 'refund_failed'].includes(normalizedType)) {
    return {
      label: normalizedType === 'session_booked' ? 'View session' : 'View sessions',
      href: '/portal/sessions',
    };
  }
  if (['payment_failed', 'payment_conflict'].includes(normalizedType)) {
    return { label: 'Review booking', href: '/portal/book' };
  }
  if (normalizedType === 'therapist_assigned') {
    return { label: 'Meet your therapist', href: '/portal/therapist' };
  }
  if (normalizedType === 'therapist_assignment_released') {
    return { label: 'Find a therapist', href: '/therapists' };
  }
  if (Number.isInteger(bookingId) && bookingId > 0) {
    return { label: 'View sessions', href: '/portal/sessions' };
  }
  return null;
};

module.exports = {
  notificationAction,
  quoteIndexForDate,
  safeMetadata,
  utcDateKey,
  utcDayOrdinal,
};
