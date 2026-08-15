const MAX_SIGNUP_FULL_NAME_LENGTH = 200;

const normalizeSignupFullName = (value) => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length < 2 || normalized.length > MAX_SIGNUP_FULL_NAME_LENGTH) return null;
  return normalized;
};

const isPlaceholderFullName = (fullName, email) => {
  const normalizedName = String(fullName || '').trim().toLowerCase();
  if (!normalizedName) return true;
  const emailLocalPart = String(email || '').trim().toLowerCase().split('@')[0];
  return normalizedName === 'shura'
    || normalizedName === 'shura user'
    || Boolean(emailLocalPart && normalizedName === emailLocalPart);
};

module.exports = {
  MAX_SIGNUP_FULL_NAME_LENGTH,
  isPlaceholderFullName,
  normalizeSignupFullName,
};
