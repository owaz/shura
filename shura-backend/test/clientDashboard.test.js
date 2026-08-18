const test = require('node:test');
const assert = require('node:assert/strict');
const {
  notificationAction,
  quoteIndexForDate,
  utcDateKey,
  utcDayOrdinal,
} = require('../utils/clientDashboard');

test('uses a stable UTC date boundary for every client and server region', () => {
  assert.equal(utcDateKey('2026-08-17T23:59:59.999Z'), '2026-08-17');
  assert.equal(utcDateKey('2026-08-18T03:59:59.999+04:00'), '2026-08-17');
  assert.equal(utcDateKey('2026-08-18T00:00:00.000Z'), '2026-08-18');
  assert.equal(utcDayOrdinal('invalid'), null);
});

test('selects one deterministic quote index per UTC day', () => {
  const first = quoteIndexForDate('2026-08-17T00:01:00.000Z', 21);
  const sameDay = quoteIndexForDate('2026-08-17T23:59:59.000Z', 21);
  const nextDay = quoteIndexForDate('2026-08-18T00:00:00.000Z', 21);
  assert.equal(first, sameDay);
  assert.equal(nextDay, (first + 1) % 21);
  assert.equal(quoteIndexForDate(new Date(), 0), null);
});

test('derives notification actions from server-known types, not metadata URLs', () => {
  assert.deepEqual(notificationAction('session_rescheduled', { href: 'https://malicious.example' }), {
    label: 'View sessions',
    href: '/portal/sessions',
  });
  assert.deepEqual(notificationAction('payment_conflict', {}), {
    label: 'Review booking',
    href: '/portal/book',
  });
  assert.deepEqual(notificationAction('therapist_assignment_released', {}), {
    label: 'Find a therapist',
    href: '/therapists',
  });
  assert.equal(notificationAction('platform_update', { href: '/admin' }), null);
});
