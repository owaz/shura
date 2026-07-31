class VideoProviderNotConfiguredError extends Error {
  constructor() {
    super('A video provider has not been configured yet.');
    this.code = 'VIDEO_PROVIDER_NOT_CONFIGURED';
  }
}

class UnconfiguredVideoProvider {
  async createRoom() {
    throw new VideoProviderNotConfiguredError();
  }

  async createParticipantAccess() {
    throw new VideoProviderNotConfiguredError();
  }

  async endRoom() {
    throw new VideoProviderNotConfiguredError();
  }

  async getRoomStatus() {
    return { provider: 'unconfigured', status: 'unavailable' };
  }
}

const getVideoProvider = () => new UnconfiguredVideoProvider();

module.exports = { getVideoProvider, VideoProviderNotConfiguredError };
