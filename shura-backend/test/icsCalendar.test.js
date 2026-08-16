const test = require('node:test');
const assert = require('node:assert/strict');
const { buildBookingIcs } = require('../utils/icsCalendar');

test('builds a portable UTC calendar event with escaped client-safe metadata', () => {
  const result = buildBookingIcs({
    bookingId: 42,
    scheduledAt: '2026-08-20T09:30:00.000Z',
    durationMinutes: 50,
    therapistName: 'Dr. Aisha, LMFT',
    sessionType: 'video',
  });
  assert.match(result, /BEGIN:VCALENDAR\r\nVERSION:2.0/);
  assert.match(result, /DTSTART:20260820T093000Z/);
  assert.match(result, /DTEND:20260820T102000Z/);
  assert.match(result, /Dr\. Aisha\\, LMFT/);
  assert.match(result, /UID:booking-42@shura/);
  assert.ok(result.endsWith('\r\n'));
});
