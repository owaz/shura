const VIDEO_PROVIDER_ERROR_CODES = Object.freeze([
  'NOT_CONFIGURED',
  'AUTHENTICATION_FAILED',
  'INVALID_REQUEST',
  'ROOM_NOT_FOUND',
  'ROOM_ALREADY_EXISTS',
  'RATE_LIMITED',
  'TIMEOUT',
  'UNAVAILABLE',
  'UNKNOWN',
]);

const SUPPORTED_VIDEO_PROVIDERS = Object.freeze(['daily']);

class VideoProviderError extends Error {
  constructor({ code = 'UNKNOWN', message = 'Video provider operation failed.', retryable = false } = {}) {
    super(message);
    this.name = 'VideoProviderError';
    this.code = VIDEO_PROVIDER_ERROR_CODES.includes(code) ? code : 'UNKNOWN';
    this.retryable = Boolean(retryable);
  }
}

class VideoProviderNotConfiguredError extends VideoProviderError {
  constructor() {
    super({
      code: 'NOT_CONFIGURED',
      message: 'A video provider has not been configured yet.',
      retryable: false,
    });
    // Kept for compatibility with existing route-level handling.
    this.legacyCode = 'VIDEO_PROVIDER_NOT_CONFIGURED';
  }
}

class UnconfiguredVideoProvider {
  async createRoom() {
    throw new VideoProviderNotConfiguredError();
  }

  async createToken() {
    throw new VideoProviderNotConfiguredError();
  }

  async createParticipantAccess() {
    throw new VideoProviderNotConfiguredError();
  }

  async endSession() {
    throw new VideoProviderNotConfiguredError();
  }

  async endRoom() {
    throw new VideoProviderNotConfiguredError();
  }

  async deleteRoom() {
    throw new VideoProviderNotConfiguredError();
  }

  async getRoomStatus() {
    return { exists: false, status: 'unavailable', participants: [], activeParticipantCount: 0 };
  }
}

const normalizeProviderName = (value) => String(value || '').trim().toLowerCase();

const getConfiguredVideoProviderName = (env = process.env) => {
  const provider = normalizeProviderName(env.VIDEO_PROVIDER);
  return SUPPORTED_VIDEO_PROVIDERS.includes(provider) ? provider : '';
};

const isLegacyClientSessionJoinEnabled = (env = process.env) => !getConfiguredVideoProviderName(env);

const assertVideoProviderConfiguration = (env = process.env) => {
  const provider = normalizeProviderName(env.VIDEO_PROVIDER);
  if (!provider) return;
  if (!SUPPORTED_VIDEO_PROVIDERS.includes(provider)) {
    throw new Error(
      `VIDEO_PROVIDER must be one of: ${SUPPORTED_VIDEO_PROVIDERS.join(', ')}`
    );
  }
  if (provider === 'daily') {
    const { validateDailyVideoConfiguration } = require('./dailyVideoProvider');
    const errors = validateDailyVideoConfiguration(env);
    if (errors.length) {
      throw new Error(`Invalid video provider configuration: ${errors.join('; ')}`);
    }
  }
};

const getVideoProvider = (env = process.env) => {
  const provider = getConfiguredVideoProviderName(env);
  if (provider === 'daily') {
    const { DailyVideoProvider, readDailyVideoConfiguration } = require('./dailyVideoProvider');
    return new DailyVideoProvider(readDailyVideoConfiguration(env));
  }
  return new UnconfiguredVideoProvider();
};

module.exports = {
  VideoProviderError,
  VideoProviderNotConfiguredError,
  VIDEO_PROVIDER_ERROR_CODES,
  assertVideoProviderConfiguration,
  getConfiguredVideoProviderName,
  getVideoProvider,
  isLegacyClientSessionJoinEnabled,
};
