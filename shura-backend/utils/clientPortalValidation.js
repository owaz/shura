const GENDERS = new Set(['male', 'female', 'prefer_not_to_say']);
const RELATIONSHIPS = new Set(['spouse', 'parent', 'sibling', 'friend', 'other']);
const THERAPIST_GENDERS = new Set(['female_only', 'male_only', 'no_preference']);
const ISLAMIC_APPROACHES = new Set(['faith_integrated', 'faith_aware', 'no_preference']);
const SESSION_TYPES = new Set(['video', 'audio', 'text', 'no_preference']);
const SESSION_DURATIONS = new Set(['30', '50', '80', 'no_preference']);
const TIMES_OF_DAY = new Set(['morning', 'afternoon', 'evening', 'night', 'no_preference']);
const DAYS = new Set(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
const cleanString = (value, maxLength = 255) => {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return undefined;
  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
};

const validateDateOfBirth = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  const [year, month, day] = value.split('-').map(Number);
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() + 1 === month
    && parsed.getUTCDate() === day
    && parsed <= new Date();
};

const validateTimezone = (value) => {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
};

const validatePhone = (value) => value === null || value === '' || (
  typeof value === 'string' && /^\+[1-9]\d{6,14}$/.test(value.replace(/[\s()-]/g, ''))
);

const stringArray = (value, { maxItems = 20, maxLength = 100, lowercase = false } = {}) => {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const normalized = value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => (lowercase ? item.toLowerCase() : item));
  if (normalized.some((item) => item.length > maxLength)) return null;
  return [...new Set(normalized)];
};

const profileColumnMap = {
  firstName: 'first_name',
  lastName: 'last_name',
  dateOfBirth: 'date_of_birth',
  gender: 'gender',
  phone: 'phone',
  country: 'country',
  city: 'city',
  timezone: 'timezone',
  aboutMe: 'about_me',
  emergencyContactName: 'emergency_contact_name',
  emergencyContactRelationship: 'emergency_contact_relationship',
  emergencyContactPhone: 'emergency_contact_phone',
};

const validateProfilePatch = (input, { requireCore = false } = {}) => {
  const errors = {};
  const values = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { errors: { body: 'A JSON object is required.' }, values };
  }

  const addText = (key, maxLength, required = false) => {
    if (!hasOwn(input, key) && !required) return;
    const value = cleanString(input[key], maxLength);
    if (value === undefined || (required && !value)) errors[key] = `${key} is required.`;
    else values[key] = value;
  };

  addText('firstName', 100, requireCore);
  addText('lastName', 100, requireCore);
  addText('country', 100);
  addText('city', 120);
  addText('aboutMe', 500);
  addText('emergencyContactName', 255);

  if (hasOwn(input, 'dateOfBirth') || requireCore) {
    if (!validateDateOfBirth(input.dateOfBirth)) errors.dateOfBirth = 'Enter a valid date of birth.';
    else values.dateOfBirth = input.dateOfBirth;
  }
  if (hasOwn(input, 'gender') || requireCore) {
    if (!GENDERS.has(input.gender)) errors.gender = 'Select a valid gender option.';
    else values.gender = input.gender;
  }
  if (hasOwn(input, 'timezone') || requireCore) {
    if (!validateTimezone(input.timezone)) errors.timezone = 'Select a valid timezone.';
    else values.timezone = input.timezone;
  }
  for (const key of ['phone', 'emergencyContactPhone']) {
    if (!hasOwn(input, key)) continue;
    const value = cleanString(input[key], 50);
    if (!validatePhone(value)) errors[key] = 'Use an international phone number such as +971501234567.';
    else values[key] = value ? value.replace(/[\s()-]/g, '') : null;
  }
  if (hasOwn(input, 'emergencyContactRelationship')) {
    const value = cleanString(input.emergencyContactRelationship, 50);
    if (value && !RELATIONSHIPS.has(value)) errors.emergencyContactRelationship = 'Select a valid relationship.';
    else values.emergencyContactRelationship = value;
  }
  return { errors, values };
};

const preferenceDefinitions = {
  therapistGenderPreference: { column: 'therapist_gender_preference', set: THERAPIST_GENDERS },
  languages: { column: 'languages', array: true },
  islamicApproach: { column: 'islamic_approach', set: ISLAMIC_APPROACHES },
  specialisationInterests: { column: 'specialisation_interests', array: true },
  sessionTypePreference: { column: 'session_type_preference', set: SESSION_TYPES },
  sessionDurationPreference: { column: 'session_duration_preference', set: SESSION_DURATIONS },
  preferredDays: { column: 'preferred_days', array: true, allowed: DAYS, lowercase: true },
  preferredTimeOfDay: { column: 'preferred_time_of_day', set: TIMES_OF_DAY },
  notificationEmailReminder24h: { column: 'notification_email_reminder_24h', boolean: true },
  notificationEmailReminder1h: { column: 'notification_email_reminder_1h', boolean: true },
  notificationSmsReminder1h: { column: 'notification_sms_reminder_1h', boolean: true },
  notificationBookingConfirmation: { column: 'notification_booking_confirmation', boolean: true },
  notificationCancellation: { column: 'notification_cancellation', boolean: true },
  notificationPlatformUpdates: { column: 'notification_platform_updates', boolean: true },
  privacyShareAboutMe: { column: 'privacy_share_about_me', boolean: true },
  privacyAllowAnonymisedData: { column: 'privacy_allow_anonymised_data', boolean: true },
};

const validatePreferencePatch = (input, { requireMatching = false } = {}) => {
  const errors = {};
  const values = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { errors: { body: 'A JSON object is required.' }, values };
  }
  for (const [key, definition] of Object.entries(preferenceDefinitions)) {
    if (!hasOwn(input, key)) continue;
    const raw = input[key];
    if (definition.boolean) {
      if (typeof raw !== 'boolean') errors[key] = 'Choose on or off.';
      else values[key] = raw;
    } else if (definition.array) {
      const list = stringArray(raw, { lowercase: definition.lowercase });
      if (list === null || (definition.allowed && list.some((item) => !definition.allowed.has(item)))) {
        errors[key] = 'Choose valid options.';
      } else values[key] = list;
    } else if (!definition.set.has(raw)) {
      errors[key] = 'Choose a valid option.';
    } else values[key] = raw;
  }
  if (hasOwn(values, 'languages') && values.languages.length === 0) {
    errors.languages = 'Select at least one language.';
  }
  if (requireMatching) {
    for (const key of ['therapistGenderPreference', 'islamicApproach']) {
      if (!hasOwn(values, key)) errors[key] = 'This preference is required.';
    }
    if (!Array.isArray(values.languages) || !values.languages.length) {
      errors.languages = 'Select at least one language.';
    }
  }
  return { errors, values };
};

module.exports = {
  profileColumnMap,
  preferenceDefinitions,
  validateDateOfBirth,
  validatePhone,
  validatePreferencePatch,
  validateProfilePatch,
  validateTimezone,
};
