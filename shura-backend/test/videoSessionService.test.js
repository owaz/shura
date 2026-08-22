const test = require('node:test');
const assert = require('node:assert/strict');
const { VideoProviderNotConfiguredError } = require('../services/video/videoProvider');
const { VideoSessionService, VideoSessionServiceError } = require('../services/video/videoSessionService');

const baseRow = Object.freeze({
  booking_id: 33,
  user_id: 7,
  therapist_id: 9,
  scheduled_at: '2026-08-22T10:00:00.000Z',
  duration_minutes: 50,
  session_type: 'video',
  booking_status: 'confirmed',
  payment_kind: 'paid',
  video_room_id: 'opaque-room-name',
  video_session_id: 101,
  video_status: 'ready',
  participant_provider_user_id: 'ccf6f74d-dad8-4d58-8ef6-b87d4d393f68',
  participant_first_joined_at: null,
  participant_connection_count: 0,
  has_paid_payment: true,
  refund_blocked: false,
});

const dbWithRows = (rows) => {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      return { rows };
    },
    async connect() {
      throw new Error('Unexpected transaction in this test');
    },
  };
};

test('issues participant access only from server-authorized booking context', async () => {
  const db = dbWithRows([baseRow]);
  let tokenInput = null;
  const service = new VideoSessionService({
    db,
    now: () => new Date('2026-08-22T09:55:00.000Z'),
    providerFactory: () => ({
      async createToken(input) {
        tokenInput = input;
        return {
          roomUrl: 'https://shura.daily.co/opaque-room-name',
          accessToken: 'daily.jwt.token',
          accessExpiresAt: '2026-08-22T11:05:00.000Z',
          hardEndsAt: '2026-08-22T11:05:00.000Z',
          startVideoOff: false,
        };
      },
    }),
  });

  const access = await service.issueParticipantAccess({
    bookingId: 33,
    principalRole: 'client',
    principalId: 7,
    participantName: 'Client Name',
  });

  assert.equal(access.mode, 'video');
  assert.equal(access.roomUrl, 'https://shura.daily.co/opaque-room-name');
  assert.equal(access.accessToken, 'daily.jwt.token');
  assert.equal(tokenInput.roomName, 'opaque-room-name');
  assert.equal(tokenInput.role, 'client');
  assert.equal(tokenInput.participantUserId, baseRow.participant_provider_user_id);
});

test('returns uniform 403 for unknown bookings and disallowed roles', async () => {
  const missing = new VideoSessionService({
    db: dbWithRows([]),
    providerFactory: () => ({ createToken: async () => ({}) }),
  });

  await assert.rejects(
    () => missing.issueParticipantAccess({
      bookingId: 1234,
      principalRole: 'client',
      principalId: 7,
    }),
    (error) => error instanceof VideoSessionServiceError
      && error.status === 403
      && error.code === 'SESSION_ACCESS_DENIED'
  );

  await assert.rejects(
    () => missing.issueParticipantAccess({
      bookingId: 1234,
      principalRole: 'admin',
      principalId: 1,
    }),
    (error) => error instanceof VideoSessionServiceError
      && error.status === 403
      && error.code === 'SESSION_ACCESS_DENIED'
  );
});

test('rejects missing scheduled_at and unsupported text sessions', async () => {
  const missingTimeService = new VideoSessionService({
    db: dbWithRows([{ ...baseRow, scheduled_at: null }]),
    now: () => new Date('2026-08-22T09:55:00.000Z'),
    providerFactory: () => ({ createToken: async () => ({}) }),
  });
  await assert.rejects(
    () => missingTimeService.issueParticipantAccess({
      bookingId: 33,
      principalRole: 'client',
      principalId: 7,
    }),
    (error) => error instanceof VideoSessionServiceError
      && error.status === 422
      && error.code === 'SESSION_TIME_MISSING'
  );

  const textService = new VideoSessionService({
    db: dbWithRows([{ ...baseRow, session_type: 'text' }]),
    now: () => new Date('2026-08-22T09:55:00.000Z'),
    providerFactory: () => ({ createToken: async () => ({}) }),
  });
  await assert.rejects(
    () => textService.issueParticipantAccess({
      bookingId: 33,
      principalRole: 'client',
      principalId: 7,
    }),
    (error) => error instanceof VideoSessionServiceError
      && error.status === 409
      && error.code === 'SESSION_TYPE_UNSUPPORTED'
  );
});

test('maps provider configuration failures to public 503 codes', async () => {
  const service = new VideoSessionService({
    db: dbWithRows([baseRow]),
    now: () => new Date('2026-08-22T09:55:00.000Z'),
    providerFactory: () => ({
      async createToken() {
        throw new VideoProviderNotConfiguredError();
      },
    }),
  });

  await assert.rejects(
    () => service.issueParticipantAccess({
      bookingId: 33,
      principalRole: 'client',
      principalId: 7,
    }),
    (error) => error instanceof VideoSessionServiceError
      && error.status === 503
      && error.code === 'VIDEO_PROVIDER_NOT_CONFIGURED'
  );
});
