export const countryOptions = [
  'Afghanistan', 'Algeria', 'Australia', 'Bahrain', 'Bangladesh', 'Canada', 'Egypt', 'France',
  'Germany', 'India', 'Indonesia', 'Jordan', 'Kuwait', 'Lebanon', 'Malaysia', 'Morocco',
  'Netherlands', 'New Zealand', 'Nigeria', 'Oman', 'Pakistan', 'Palestine', 'Qatar',
  'Saudi Arabia', 'Singapore', 'South Africa', 'Spain', 'Sweden', 'Turkey', 'United Arab Emirates',
  'United Kingdom', 'United States',
];

export const timezoneOptions = (() => {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return [
      'Asia/Dubai', 'Asia/Riyadh', 'Asia/Qatar', 'Asia/Kuwait', 'Asia/Muscat', 'Asia/Karachi',
      'Asia/Kolkata', 'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Chicago',
      'America/Denver', 'America/Los_Angeles', 'Australia/Sydney',
    ];
  }
})();

export const defaultPhoneCodes = [
  { code: '+971', label: 'UAE (+971)' },
  { code: '+966', label: 'Saudi Arabia (+966)' },
  { code: '+974', label: 'Qatar (+974)' },
  { code: '+965', label: 'Kuwait (+965)' },
  { code: '+973', label: 'Bahrain (+973)' },
  { code: '+968', label: 'Oman (+968)' },
  { code: '+44', label: 'United Kingdom (+44)' },
  { code: '+1', label: 'United States / Canada (+1)' },
  { code: '+91', label: 'India (+91)' },
  { code: '+92', label: 'Pakistan (+92)' },
];

export const detectedTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Dubai';
