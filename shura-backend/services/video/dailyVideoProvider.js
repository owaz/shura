const crypto = require('crypto');
const { VideoProviderError } = require('./videoProvider');

const REQUIRED_DAILY_VARIABLES = Object.freeze([
  'DAILY_API_KEY',
  'DAILY_DOMAIN',
  'DAILY_API_URL',
  'DAILY_WEBHOOK_HMAC',
]);

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRY_DELAYS_MS = Object.freeze([300, 900]);
const MINUTES = Object.freeze({
  therapistJoinOpen: 20,
  clientJoinOpen: 10,
  hardEndGrace: 15,
});

const trimValue = (value) => String(value || '').trim();

const isStrictBase64 = (value) => {
  if (!value || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
  try {
    return Buffer.from(value, 'base64').length > 0;
  } catch {
    return false;
  }
};

const asHttpsUrl = (value) => {
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:') {
    throw new Error('must use https');
  }
  return parsed;
};

const validateDailyVideoConfiguration = (env = process.env) => {
  const errors = REQUIRED_DAILY_VARIABLES
    .filter((key) => !trimValue(env[key]))
    .map((key) => `${key} must be configured`);

  const apiUrl = trimValue(env.DAILY_API_URL);
  if (apiUrl) {
    try {
      asHttpsUrl(apiUrl);
    } catch {
      errors.push('DAILY_API_URL must be a valid https URL');
    }
  }

  const domain = trimValue(env.DAILY_DOMAIN).toLowerCase();
  if (domain && !/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.daily\.co$/.test(domain)) {
    errors.push('DAILY_DOMAIN must be a Daily domain such as tenant.daily.co');
  }

  const webhookHmac = trimValue(env.DAILY_WEBHOOK_HMAC);
  if (webhookHmac && !isStrictBase64(webhookHmac)) {
    errors.push('DAILY_WEBHOOK_HMAC must be a valid base64 value');
  }

  return errors;
};

const readDailyVideoConfiguration = (env = process.env) => {
  const errors = validateDailyVideoConfiguration(env);
  if (errors.length) {
    throw new Error(`Invalid video provider configuration: ${errors.join('; ')}`);
  }
  return {
    apiKey: trimValue(env.DAILY_API_KEY),
    apiUrl: trimValue(env.DAILY_API_URL).replace(/\/+$/, ''),
    domain: trimValue(env.DAILY_DOMAIN).toLowerCase(),
    webhookHmac: Buffer.from(trimValue(env.DAILY_WEBHOOK_HMAC), 'base64'),
    requestTimeoutMs: DEFAULT_TIMEOUT_MS,
    retryDelaysMs: DEFAULT_RETRY_DELAYS_MS,
  };
};

const toEpochSeconds = (value) => Math.floor(value.getTime() / 1000);

const parseDate = (value, fieldName) => {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new VideoProviderError({
      code: 'INVALID_REQUEST',
      message: `${fieldName} must be a valid ISO timestamp`,
      retryable: false,
    });
  }
  return date;
};

const parseDurationMinutes = (value) => {
  const duration = Number(value);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new VideoProviderError({
      code: 'INVALID_REQUEST',
      message: 'durationMinutes must be a positive number',
      retryable: false,
    });
  }
  return duration;
};

const parseRole = (value) => {
  const role = String(value || '').toLowerCase();
  if (!['client', 'therapist'].includes(role)) {
    throw new VideoProviderError({
      code: 'INVALID_REQUEST',
      message: 'role must be client or therapist',
      retryable: false,
    });
  }
  return role;
};

const parseSessionMode = (value) => {
  const mode = String(value || 'video').toLowerCase();
  if (!['audio', 'video'].includes(mode)) {
    throw new VideoProviderError({
      code: 'INVALID_REQUEST',
      message: 'sessionMode must be audio or video',
      retryable: false,
    });
  }
  return mode;
};

const buildSessionTimes = ({ scheduledAt, durationMinutes }) => {
  const start = parseDate(scheduledAt, 'scheduledAt');
  const duration = parseDurationMinutes(durationMinutes);
  const scheduledEnd = new Date(start.getTime() + (duration * 60_000));
  const hardEnd = new Date(scheduledEnd.getTime() + (MINUTES.hardEndGrace * 60_000));
  const roomOpenAt = new Date(start.getTime() - (MINUTES.therapistJoinOpen * 60_000));
  return {
    start,
    scheduledEnd,
    hardEnd,
    roomOpenAt,
  };
};

const buildRoleTokenWindow = ({ start, hardEnd, role }) => {
  const openMinutes = role === 'therapist' ? MINUTES.therapistJoinOpen : MINUTES.clientJoinOpen;
  const opensAt = new Date(start.getTime() - (openMinutes * 60_000));
  return {
    opensAt,
    hardEnd,
  };
};

const canSendByMode = (sessionMode) => (sessionMode === 'audio' ? ['audio'] : ['audio', 'video']);

const buildRoomUrl = (domain, roomName) => `https://${domain}/${roomName}`;

const buildRoomName = () => `shura-${crypto.randomBytes(16).toString('hex')}`;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeErrorFromResponse = (status, operation) => {
  if (status === 401 || status === 403) {
    return new VideoProviderError({
      code: 'AUTHENTICATION_FAILED',
      message: `Daily ${operation} authentication failed`,
      retryable: false,
    });
  }
  if (status === 404) {
    return new VideoProviderError({
      code: 'ROOM_NOT_FOUND',
      message: `Daily ${operation} room not found`,
      retryable: false,
    });
  }
  if (status === 409) {
    return new VideoProviderError({
      code: 'ROOM_ALREADY_EXISTS',
      message: `Daily ${operation} room conflict`,
      retryable: false,
    });
  }
  if (status === 429) {
    return new VideoProviderError({
      code: 'RATE_LIMITED',
      message: `Daily ${operation} rate limited`,
      retryable: false,
    });
  }
  if (status >= 500) {
    return new VideoProviderError({
      code: 'UNAVAILABLE',
      message: `Daily ${operation} unavailable`,
      retryable: true,
    });
  }
  return new VideoProviderError({
    code: 'INVALID_REQUEST',
    message: `Daily ${operation} rejected request`,
    retryable: false,
  });
};

class DailyVideoProvider {
  constructor(config) {
    this.config = {
      requestTimeoutMs: DEFAULT_TIMEOUT_MS,
      retryDelaysMs: DEFAULT_RETRY_DELAYS_MS,
      ...config,
    };
  }

  async requestWithRetry({ method, path, operation, body = null }) {
    const retryDelaysMs = Array.isArray(this.config.retryDelaysMs) ? this.config.retryDelaysMs : [];
    for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
      try {
        return await this.requestOnce({ method, path, operation, body });
      } catch (error) {
        if (!(error instanceof VideoProviderError) || !error.retryable || attempt >= retryDelaysMs.length) {
          throw error;
        }
        await delay(Math.max(0, Number(retryDelaysMs[attempt]) || 0));
      }
    }
    throw new VideoProviderError({ code: 'UNKNOWN', message: `Daily ${operation} failed`, retryable: false });
  }

  async requestOnce({ method, path, operation, body = null }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
    let response;
    try {
      response = await fetch(`${this.config.apiUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new VideoProviderError({
          code: 'TIMEOUT',
          message: `Daily ${operation} timed out`,
          retryable: true,
        });
      }
      throw new VideoProviderError({
        code: 'UNAVAILABLE',
        message: `Daily ${operation} request failed`,
        retryable: true,
      });
    } finally {
      clearTimeout(timeout);
    }

    const responseText = await response.text();
    let payload = null;
    if (responseText) {
      try {
        payload = JSON.parse(responseText);
      } catch {
        payload = null;
      }
    }

    if (response.ok) {
      return payload || {};
    }

    throw normalizeErrorFromResponse(response.status, operation);
  }

  async createRoom(input) {
    const sessionMode = parseSessionMode(input?.sessionMode);
    const times = buildSessionTimes({
      scheduledAt: input?.scheduledAt,
      durationMinutes: input?.durationMinutes,
    });
    const roomName = buildRoomName();
    const roomPayload = {
      name: roomName,
      privacy: 'private',
      properties: {
        nbf: toEpochSeconds(times.roomOpenAt),
        exp: toEpochSeconds(times.hardEnd),
        eject_at_room_exp: true,
        max_participants: 2,
        enable_prejoin_ui: true,
        enable_network_ui: true,
        enable_knocking: false,
        enable_screenshare: false,
        enable_chat: false,
        enable_people_ui: false,
        enable_recording: [],
        enforce_unique_user_ids: true,
        permissions: {
          canSend: canSendByMode(sessionMode),
        },
        ...(sessionMode === 'audio' ? { start_video_off: true } : {}),
      },
    };

    const created = await this.requestWithRetry({
      method: 'POST',
      path: '/rooms',
      operation: 'room provisioning',
      body: roomPayload,
    });

    const providerRoomName = trimValue(created.name) || roomName;
    const roomUrl = trimValue(created.url) || buildRoomUrl(this.config.domain, providerRoomName);
    return {
      // Legacy `clientSessions` route currently reads `room.id || room.roomId`.
      id: providerRoomName,
      roomId: trimValue(created.id) || null,
      roomName: providerRoomName,
      roomUrl,
      notBefore: times.roomOpenAt.toISOString(),
      expiresAt: times.hardEnd.toISOString(),
    };
  }

  async createToken(input) {
    const roomName = trimValue(input?.roomName);
    if (!roomName) {
      throw new VideoProviderError({
        code: 'INVALID_REQUEST',
        message: 'roomName is required when creating a meeting token',
        retryable: false,
      });
    }
    const role = parseRole(input?.role);
    const participantUserId = trimValue(input?.participantUserId);
    const participantDisplayName = trimValue(input?.participantDisplayName);
    if (!participantUserId) {
      throw new VideoProviderError({
        code: 'INVALID_REQUEST',
        message: 'participantUserId is required when creating a meeting token',
        retryable: false,
      });
    }
    if (!participantDisplayName) {
      throw new VideoProviderError({
        code: 'INVALID_REQUEST',
        message: 'participantDisplayName is required when creating a meeting token',
        retryable: false,
      });
    }

    const sessionMode = parseSessionMode(input?.sessionMode);
    const times = buildSessionTimes({
      scheduledAt: input?.scheduledAt,
      durationMinutes: input?.durationMinutes,
    });
    const tokenWindow = buildRoleTokenWindow({
      start: times.start,
      hardEnd: times.hardEnd,
      role,
    });

    const properties = {
      room_name: roomName,
      is_owner: role === 'therapist',
      user_id: participantUserId,
      user_name: participantDisplayName,
      nbf: toEpochSeconds(tokenWindow.opensAt),
      exp: toEpochSeconds(tokenWindow.hardEnd),
      // Token-level ejection settings override room-level ejection settings.
      eject_at_token_exp: true,
      enable_recording: [],
      enable_recording_ui: false,
      permissions: {
        canSend: canSendByMode(sessionMode),
      },
      ...(sessionMode === 'audio' ? { start_video_off: true } : {}),
    };

    if (!properties.room_name) {
      throw new VideoProviderError({
        code: 'INVALID_REQUEST',
        message: 'room_name must be set on all meeting tokens',
        retryable: false,
      });
    }

    const tokenResponse = await this.requestWithRetry({
      method: 'POST',
      path: '/meeting-tokens',
      operation: 'token creation',
      body: { properties },
    });

    const token = trimValue(tokenResponse.token);
    if (!token) {
      throw new VideoProviderError({
        code: 'UNKNOWN',
        message: 'Daily token creation response did not include a token',
        retryable: false,
      });
    }

    return {
      roomName,
      roomUrl: buildRoomUrl(this.config.domain, roomName),
      accessToken: token,
      accessExpiresAt: tokenWindow.hardEnd.toISOString(),
      hardEndsAt: tokenWindow.hardEnd.toISOString(),
      startVideoOff: sessionMode === 'audio',
    };
  }

  // Backward-compat method for the existing client sessions route while the new
  // dedicated video route is implemented in later checkpoints.
  async createParticipantAccess(input) {
    const token = await this.createToken({
      roomName: trimValue(input?.roomName || input?.roomId),
      role: input?.role,
      participantUserId: trimValue(input?.participantUserId) || crypto.randomUUID(),
      participantDisplayName: trimValue(input?.participantDisplayName)
        || (String(input?.role || '').toLowerCase() === 'therapist' ? 'Therapist' : 'Client'),
      sessionMode: input?.sessionMode || 'video',
      scheduledAt: input?.scheduledAt || new Date(),
      durationMinutes: input?.durationMinutes || 50,
    });
    return {
      url: token.roomUrl,
      token: token.accessToken,
      expiresAt: token.accessExpiresAt,
      hardEndsAt: token.hardEndsAt,
      startVideoOff: token.startVideoOff,
    };
  }

  async getRoomStatus(input) {
    const roomName = trimValue(input?.roomName || input?.roomId);
    if (!roomName) {
      throw new VideoProviderError({
        code: 'INVALID_REQUEST',
        message: 'roomName is required when checking room status',
        retryable: false,
      });
    }

    try {
      const snapshot = await this.requestWithRetry({
        method: 'GET',
        path: `/rooms/${encodeURIComponent(roomName)}/presence?limit=20`,
        operation: 'presence lookup',
      });
      const participants = Array.isArray(snapshot.data) ? snapshot.data : [];
      return {
        exists: true,
        activeParticipantCount: Number(snapshot.total_count || participants.length || 0),
        participants: participants.map((entry) => ({
          participantSessionId: trimValue(entry.id) || null,
          providerUserId: trimValue(entry.userId) || null,
          displayName: trimValue(entry.userName) || null,
          joinedAt: entry.joinTime || null,
          durationSeconds: Number.isFinite(Number(entry.duration)) ? Number(entry.duration) : null,
        })),
      };
    } catch (error) {
      if (error instanceof VideoProviderError && error.code === 'ROOM_NOT_FOUND') {
        return {
          exists: false,
          activeParticipantCount: 0,
          participants: [],
        };
      }
      throw error;
    }
  }

  async endSession(input) {
    const roomName = trimValue(input?.roomName || input?.roomId);
    if (!roomName) {
      throw new VideoProviderError({
        code: 'INVALID_REQUEST',
        message: 'roomName is required when ending a room session',
        retryable: false,
      });
    }

    const status = await this.getRoomStatus({ roomName });
    const participantIds = status.participants
      .map((participant) => participant.participantSessionId)
      .filter(Boolean);

    if (!participantIds.length) {
      return { ended: true, ejectedCount: 0 };
    }

    const response = await this.requestWithRetry({
      method: 'POST',
      path: `/rooms/${encodeURIComponent(roomName)}/eject`,
      operation: 'session end',
      body: { ids: participantIds, ban: false },
    });
    return {
      ended: true,
      ejectedCount: Array.isArray(response.ejectedIds) ? response.ejectedIds.length : participantIds.length,
    };
  }

  async endRoom(input) {
    return this.endSession(input);
  }

  async deleteRoom(input) {
    const roomName = trimValue(input?.roomName || input?.roomId);
    if (!roomName) {
      throw new VideoProviderError({
        code: 'INVALID_REQUEST',
        message: 'roomName is required when deleting a room',
        retryable: false,
      });
    }
    try {
      const response = await this.requestWithRetry({
        method: 'DELETE',
        path: `/rooms/${encodeURIComponent(roomName)}`,
        operation: 'room deletion',
      });
      return {
        deleted: response.deleted !== false,
        roomName: trimValue(response.name) || roomName,
        alreadyDeleted: false,
      };
    } catch (error) {
      if (error instanceof VideoProviderError && error.code === 'ROOM_NOT_FOUND') {
        return {
          deleted: true,
          roomName,
          alreadyDeleted: true,
        };
      }
      throw error;
    }
  }
}

module.exports = {
  DailyVideoProvider,
  readDailyVideoConfiguration,
  validateDailyVideoConfiguration,
};
