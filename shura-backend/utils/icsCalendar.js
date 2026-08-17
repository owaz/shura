const escapeIcs = (value) => String(value ?? '')
  .replace(/\\/g, '\\\\')
  .replace(/\r?\n/g, '\\n')
  .replace(/,/g, '\\,')
  .replace(/;/g, '\\;');

const utcStamp = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('A valid calendar date is required');
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
};

const foldLine = (line) => {
  const chunks = [];
  let remaining = line;
  while (Buffer.byteLength(remaining, 'utf8') > 73) {
    let index = Math.min(73, remaining.length);
    while (Buffer.byteLength(remaining.slice(0, index), 'utf8') > 73) index -= 1;
    chunks.push(remaining.slice(0, index));
    remaining = remaining.slice(index);
  }
  chunks.push(remaining);
  return chunks.join('\r\n ');
};

const buildBookingIcs = ({ bookingId, scheduledAt, durationMinutes, therapistName, sessionType, status }) => {
  const start = new Date(scheduledAt);
  const end = new Date(start.getTime() + Number(durationMinutes) * 60_000);
  const icsStatus = String(status || '').toLowerCase() === 'cancelled' ? 'CANCELLED' : 'CONFIRMED';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Shura//Client Portal//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:booking-${Number(bookingId)}@shura`,
    `DTSTAMP:${utcStamp(new Date())}`,
    `DTSTART:${utcStamp(start)}`,
    `DTEND:${utcStamp(end)}`,
    `SUMMARY:${escapeIcs(`Shura ${sessionType} session with ${therapistName}`)}`,
    `DESCRIPTION:${escapeIcs(icsStatus === 'CANCELLED' ? 'This Shura session has been cancelled.' : 'Your confirmed Shura session. Open the Shura client portal for session details.')}`,
    `STATUS:${icsStatus}`,
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
};

module.exports = { buildBookingIcs, escapeIcs, utcStamp };
