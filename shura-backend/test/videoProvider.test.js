const test = require('node:test');
const assert = require('node:assert/strict');

const {
  VideoProviderError,
  VideoProviderNotConfiguredError,
  assertVideoProviderConfiguration,
  getVideoProvider,
} = require('../services/video/videoProvider');
const {
  DailyVideoProvider,
  readDailyVideoConfiguration,
  validateDailyVideoConfiguration,
} = require('../services/video/dailyVideoProvider');

const validEnv = {
  VIDEO_PROVIDER: 'daily',
  DAILY_API_KEY: 'daily_api_key',
  DAILY_API_URL: 'https://api.daily.co/v1',
  DAILY_DOMAIN: 'shura.daily.co',
  DAILY_WEBHOOK_HMAC: Buffer.from('video-webhook-secret').toString('base64'),
};

const mockResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => (body ? JSON.stringify(body) : ''),
});

test('validates required daily video provider configuration', () => {
  const errors = validateDailyVideoConfiguration({
    VIDEO_PROVIDER: 'daily',
    DAILY_API_KEY: '',
    DAILY_API_URL: 'http://api.daily.co/v1',
    DAILY_DOMAIN: 'not-daily.example.com',
    DAILY_WEBHOOK_HMAC: 'not-base64',
  });
  assert.ok(errors.includes('DAILY_API_KEY must be configured'));
  assert.ok(errors.includes('DAILY_API_URL must be a valid https URL'));
  assert.ok(errors.includes('DAILY_DOMAIN must be a Daily domain such as tenant.daily.co'));
  assert.ok(errors.includes('DAILY_WEBHOOK_HMAC must be a valid base64 value'));
});

test('assertVideoProviderConfiguration only fails when video provider is enabled', () => {
  assert.doesNotThrow(() => assertVideoProviderConfiguration({ VIDEO_PROVIDER: '' }));
  assert.doesNotThrow(() => assertVideoProviderConfiguration({ VIDEO_PROVIDER: undefined }));
  assert.throws(
    () => assertVideoProviderConfiguration({ VIDEO_PROVIDER: 'daily' }),
    /Invalid video provider configuration/
  );
  assert.doesNotThrow(() => assertVideoProviderConfiguration(validEnv));
});

test('getVideoProvider returns unconfigured provider when VIDEO_PROVIDER is unset', async () => {
  const provider = getVideoProvider({});
  await assert.rejects(
    () => provider.createRoom(),
    (error) => error instanceof VideoProviderNotConfiguredError && error.code === 'NOT_CONFIGURED'
  );
});

test('DailyVideoProvider createRoom uses private hardened room settings', async () => {
  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    calls.push({
      url,
      method: options.method,
      body: JSON.parse(options.body),
    });
    return mockResponse(200, {
      id: 'provider-room-id',
      name: 'opaque-room-name',
      url: 'https://shura.daily.co/opaque-room-name',
    });
  };

  try {
    const provider = new DailyVideoProvider({
      ...readDailyVideoConfiguration(validEnv),
      retryDelaysMs: [0, 0],
    });
    const room = await provider.createRoom({
      scheduledAt: '2026-06-01T10:00:00.000Z',
      durationMinutes: 50,
      sessionMode: 'audio',
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.daily.co/v1/rooms');
    assert.equal(calls[0].method, 'POST');
    assert.equal(calls[0].body.privacy, 'private');
    assert.equal(calls[0].body.properties.max_participants, 2);
    assert.equal(calls[0].body.properties.enable_knocking, false);
    assert.equal(calls[0].body.properties.enable_screenshare, false);
    assert.equal(calls[0].body.properties.enable_chat, false);
    assert.equal(calls[0].body.properties.enforce_unique_user_ids, true);
    assert.deepEqual(calls[0].body.properties.enable_recording, []);
    assert.equal(calls[0].body.properties.start_video_off, true);
    assert.deepEqual(calls[0].body.properties.permissions.canSend, ['audio']);
    assert.equal(calls[0].body.properties.nbf, 1780306800); // 2026-06-01T09:40:00Z
    assert.equal(calls[0].body.properties.exp, 1780311900); // 2026-06-01T11:05:00Z
    assert.equal(room.roomName, 'opaque-room-name');
  } finally {
    global.fetch = originalFetch;
  }
});

test('DailyVideoProvider createToken enforces room-bound, short-lived role token settings', async () => {
  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    calls.push({
      url,
      method: options.method,
      body: JSON.parse(options.body),
    });
    return mockResponse(200, { token: 'daily.jwt.token' });
  };

  try {
    const provider = new DailyVideoProvider({
      ...readDailyVideoConfiguration(validEnv),
      retryDelaysMs: [0, 0],
    });
    const access = await provider.createToken({
      roomName: 'opaque-room-name',
      role: 'therapist',
      participantUserId: '1e94b31c-9a5c-4b26-bfd0-355ab2028159',
      participantDisplayName: 'Therapist',
      scheduledAt: '2026-06-01T10:00:00.000Z',
      durationMinutes: 50,
      sessionMode: 'video',
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.daily.co/v1/meeting-tokens');
    const props = calls[0].body.properties;
    assert.equal(props.room_name, 'opaque-room-name');
    assert.equal(props.is_owner, true);
    assert.equal(props.user_id, '1e94b31c-9a5c-4b26-bfd0-355ab2028159');
    assert.equal(props.user_name, 'Therapist');
    assert.equal(props.eject_at_token_exp, true);
    assert.deepEqual(props.enable_recording, []);
    assert.equal(props.enable_recording_ui, false);
    assert.equal(props.nbf, 1780306800); // therapist join opens at start - 20m
    assert.equal(props.exp, 1780311900); // hard end at scheduled end + 15m
    assert.deepEqual(props.permissions.canSend, ['audio', 'video']);
    assert.equal(access.accessToken, 'daily.jwt.token');
    assert.equal(access.roomUrl, 'https://shura.daily.co/opaque-room-name');
  } finally {
    global.fetch = originalFetch;
  }
});

test('DailyVideoProvider retries transient provider failures and does not retry invalid requests', async () => {
  let attempts = 0;
  const originalFetch = global.fetch;
  global.fetch = async () => {
    attempts += 1;
    if (attempts === 1) {
      return mockResponse(503, { error: 'temporary failure' });
    }
    return mockResponse(200, { total_count: 0, data: [] });
  };

  try {
    const provider = new DailyVideoProvider({
      ...readDailyVideoConfiguration(validEnv),
      retryDelaysMs: [0, 0],
    });
    const status = await provider.getRoomStatus({ roomName: 'opaque-room-name' });
    assert.equal(attempts, 2);
    assert.equal(status.exists, true);
  } finally {
    global.fetch = originalFetch;
  }

  attempts = 0;
  global.fetch = async () => {
    attempts += 1;
    return mockResponse(400, { error: 'bad request' });
  };

  try {
    const provider = new DailyVideoProvider({
      ...readDailyVideoConfiguration(validEnv),
      retryDelaysMs: [0, 0],
    });
    await assert.rejects(
      () => provider.getRoomStatus({ roomName: 'opaque-room-name' }),
      (error) => error instanceof VideoProviderError
        && error.code === 'INVALID_REQUEST'
        && attempts === 1
    );
  } finally {
    global.fetch = originalFetch;
  }
});
