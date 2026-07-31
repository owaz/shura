const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateDateOfBirth,
  validatePhone,
  validatePreferencePatch,
  validateProfilePatch,
  validateTimezone,
} = require('../utils/clientPortalValidation');

test('validates real past dates and rejects impossible or future dates', () => {
  assert.equal(validateDateOfBirth('1990-02-28'), true);
  assert.equal(validateDateOfBirth('1990-02-31'), false);
  assert.equal(validateDateOfBirth('2990-01-01'), false);
});

test('validates IANA timezones', () => {
  assert.equal(validateTimezone('Asia/Dubai'), true);
  assert.equal(validateTimezone('Not/A_Timezone'), false);
});

test('accepts optional E.164 phones and rejects local-only values', () => {
  assert.equal(validatePhone(null), true);
  assert.equal(validatePhone('+971 50 123 4567'), true);
  assert.equal(validatePhone('0501234567'), false);
});

test('requires the onboarding core profile fields', () => {
  const invalid = validateProfilePatch({}, { requireCore: true });
  assert.deepEqual(Object.keys(invalid.errors).sort(), ['dateOfBirth', 'firstName', 'gender', 'lastName', 'timezone']);

  const valid = validateProfilePatch({
    firstName: 'Amina',
    lastName: 'Khan',
    dateOfBirth: '1992-04-10',
    gender: 'female',
    timezone: 'Asia/Dubai',
    phone: '+971501234567',
  }, { requireCore: true });
  assert.deepEqual(valid.errors, {});
  assert.equal(valid.values.firstName, 'Amina');
});

test('requires all three matching preferences during onboarding', () => {
  const invalid = validatePreferencePatch({}, { requireMatching: true });
  assert.ok(invalid.errors.therapistGenderPreference);
  assert.ok(invalid.errors.languages);
  assert.ok(invalid.errors.islamicApproach);

  const valid = validatePreferencePatch({
    therapistGenderPreference: 'female_only',
    languages: ['English', 'Arabic'],
    islamicApproach: 'faith_aware',
  }, { requireMatching: true });
  assert.deepEqual(valid.errors, {});
});

test('does not allow a completed client to clear every language preference', () => {
  const result = validatePreferencePatch({ languages: [] });
  assert.equal(result.errors.languages, 'Select at least one language.');
});

test('normalizes preferred days and rejects unsupported values', () => {
  const valid = validatePreferencePatch({ preferredDays: ['Monday', 'FRIDAY'] });
  assert.deepEqual(valid.values.preferredDays, ['monday', 'friday']);
  const invalid = validatePreferencePatch({ preferredDays: ['Someday'] });
  assert.ok(invalid.errors.preferredDays);
});
