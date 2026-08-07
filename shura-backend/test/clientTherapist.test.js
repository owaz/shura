const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeDurations,
  normalizeSessionTypes,
  toAssignedTherapist,
  toAvailability,
} = require('../utils/clientTherapist');

test('normalizes supported session types and durations', () => {
  assert.deepEqual(normalizeSessionTypes(['Video', 'AUDIO', 'invalid', 'video']), ['video', 'audio']);
  assert.deepEqual(normalizeDurations([80, '30', 50, 80, 25]), [30, 50, 80]);
});

test('maps availability without exposing database field names', () => {
  assert.deepEqual(toAvailability([{
    day_of_week: 2,
    start_time: '09:00:00',
    end_time: '14:30:00',
    timezone: 'Asia/Dubai',
  }]), [{
    dayOfWeek: 2,
    startTime: '09:00',
    endTime: '14:30',
    timezone: 'Asia/Dubai',
  }]);
});

test('builds a stable assigned therapist response with safe defaults', () => {
  const result = toAssignedTherapist({
    therapist: {
      id: 12,
      full_name: 'Dr. Aisha Malik',
      specialization: 'Licensed Marriage and Family Therapist',
      credentials: ['LMFT', 'Islamic Psychology Practitioner'],
      is_verified: true,
      average_rating: '4.86',
      review_count: '21',
      specialties: ['Anxiety', 'CBT'],
      languages: ['English', 'Urdu'],
      session_types: ['video', 'audio'],
      session_duration_options: [50, 80],
      assigned_at: '2026-07-01T10:00:00.000Z',
    },
    imageUrl: 'https://images.example/therapist.jpg',
  });

  assert.equal(result.name, 'Dr. Aisha Malik');
  assert.equal(result.rating, 4.9);
  assert.equal(result.reviewCount, 21);
  assert.deepEqual(result.durationOptions, [50, 80]);
  assert.deepEqual(result.availability, []);
});
