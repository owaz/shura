const test = require('node:test');
const assert = require('node:assert/strict');
const { VideoProviderNotConfiguredError } = require('../services/video/videoProvider');
const { VideoSessionService, VideoSessionServiceError } = require('../services/video/videoSessionService');

const cloneDate = (value) => (value ? new Date(value.getTime()) : null);

const makeState = (overrides = {}) => {
  const booking = {
    id: 33,
    user_id: 7,
    therapist_id: 9,
    scheduled_at: '2026-08-22T10:00:00.000Z',
    duration_minutes: 50,
    session_type: 'video',
    status: 'confirmed',
    payment_kind: 'paid',
    video_room_id: null,
    ...overrides.booking,
  };

  const videoSession = overrides.videoSession === null
    ? null
    : {
      id: 101,
      booking_id: booking.id,
      status: 'scheduled',
      status_reason: null,
      updated_at: new Date('2026-08-22T09:30:00.000Z'),
      ...overrides.videoSession,
    };

  const participant = overrides.participant === null
    ? null
    : (overrides.participant
      ? {
        provider_user_id: null,
        first_joined_at: null,
        connection_count: 0,
        ...overrides.participant,
      }
      : null);

  return {
    booking,
    videoSession,
    participant,
    has_paid_payment: overrides.has_paid_payment ?? true,
    refund_blocked: overrides.refund_blocked ?? false,
  };
};

const createFakeDb = (state) => {
  const calls = [];
  const ownsBooking = (role, principalId) => (
    (role === 'client' && Number(principalId) === Number(state.booking.user_id))
    || (role === 'therapist' && Number(principalId) === Number(state.booking.therapist_id))
  );

  const asJoinRow = () => ({
    booking_id: state.booking.id,
    user_id: state.booking.user_id,
    therapist_id: state.booking.therapist_id,
    scheduled_at: state.booking.scheduled_at,
    duration_minutes: state.booking.duration_minutes,
    session_type: state.booking.session_type,
    booking_status: state.booking.status,
    payment_kind: state.booking.payment_kind,
    video_room_id: state.booking.video_room_id,
    video_session_id: state.videoSession?.id || null,
    video_status: state.videoSession?.status || null,
    video_session_updated_at: state.videoSession?.updated_at || null,
    participant_provider_user_id: state.participant?.provider_user_id || null,
    participant_first_joined_at: state.participant?.first_joined_at || null,
    participant_connection_count: state.participant?.connection_count || 0,
    has_paid_payment: state.has_paid_payment,
    refund_blocked: state.refund_blocked,
  });

  const asVideoSessionRow = () => ({
    id: state.videoSession.id,
    booking_id: state.videoSession.booking_id,
    status: state.videoSession.status,
    status_reason: state.videoSession.status_reason || null,
    updated_at: cloneDate(state.videoSession.updated_at),
  });

  const execute = async (sql, params) => {
    calls.push({ sql, params });
    const compact = sql.replace(/\s+/g, ' ').trim();

    if (compact === 'BEGIN' || compact === 'COMMIT' || compact === 'ROLLBACK') {
      return { rows: [] };
    }

    if (compact.startsWith('SELECT b.id AS booking_id')) {
      const [bookingId, role, principalId] = params;
      if (Number(bookingId) !== Number(state.booking.id) || !ownsBooking(role, principalId)) return { rows: [] };
      return { rows: [asJoinRow()] };
    }

    if (compact.startsWith('SELECT b.id, LOWER(COALESCE(b.session_type')) {
      const [bookingId, role, principalId] = params;
      if (Number(bookingId) !== Number(state.booking.id) || !ownsBooking(role, principalId)) return { rows: [] };
      return { rows: [{ id: state.booking.id, session_type: String(state.booking.session_type || '').toLowerCase() }] };
    }

    if (compact.startsWith('INSERT INTO video_sessions')) {
      if (!state.videoSession) {
        state.videoSession = {
          id: 101,
          booking_id: state.booking.id,
          status: params[1],
          status_reason: params[2] || null,
          updated_at: new Date(),
        };
      } else {
        state.videoSession.updated_at = new Date();
      }
      return { rows: [asVideoSessionRow()] };
    }

    if (compact.startsWith('SELECT b.video_room_id, vs.id AS video_session_id')) {
      const [bookingId, role, principalId] = params;
      if (
        Number(bookingId) !== Number(state.booking.id)
        || !ownsBooking(role, principalId)
        || !state.videoSession
      ) {
        return { rows: [] };
      }
      return {
        rows: [{
          video_room_id: state.booking.video_room_id,
          video_session_id: state.videoSession.id,
          video_status: String(state.videoSession.status || '').toLowerCase(),
          video_session_updated_at: cloneDate(state.videoSession.updated_at),
        }],
      };
    }

    if (compact.startsWith('SELECT b.video_room_id, LOWER(COALESCE(vs.status')) {
      const [bookingId, role, principalId] = params;
      if (
        Number(bookingId) !== Number(state.booking.id)
        || !ownsBooking(role, principalId)
        || !state.videoSession
      ) {
        return { rows: [] };
      }
      return {
        rows: [{
          video_room_id: state.booking.video_room_id,
          video_status: String(state.videoSession.status || '').toLowerCase(),
        }],
      };
    }

    if (compact.startsWith('UPDATE video_sessions SET status = $2')) {
      const [videoSessionId, nextStatus, statusReason, _startedAt, _endedAt, sourceStatuses, terminalSetForTarget, terminalSetForCurrent] = params;
      if (!state.videoSession || Number(videoSessionId) !== Number(state.videoSession.id)) return { rows: [] };
      if (!sourceStatuses.includes(state.videoSession.status)) return { rows: [] };
      const targetTerminal = terminalSetForTarget.includes(nextStatus);
      const currentTerminal = terminalSetForCurrent.includes(state.videoSession.status);
      if (!targetTerminal && currentTerminal) return { rows: [] };

      state.videoSession.status = nextStatus;
      state.videoSession.status_reason = statusReason || null;
      state.videoSession.updated_at = new Date();
      return { rows: [asVideoSessionRow()] };
    }

    if (compact.startsWith('UPDATE bookings SET video_room_id = $1')) {
      const [roomName, bookingId] = params;
      if (Number(bookingId) !== Number(state.booking.id)) return { rows: [] };
      state.booking.video_room_id = roomName;
      return { rows: [] };
    }

    if (compact.startsWith('INSERT INTO video_participants')) {
      const [videoSessionId, principalRole, principalId, providerUserId] = params;
      if (!state.videoSession || Number(videoSessionId) !== Number(state.videoSession.id)) return { rows: [] };
      if (!state.participant) {
        state.participant = {
          provider_user_id: providerUserId,
          principal_role: principalRole,
          principal_id: principalId,
          first_joined_at: null,
          connection_count: 0,
        };
      }
      return {
        rows: [{
          provider_user_id: state.participant.provider_user_id,
        }],
      };
    }

    throw new Error(`Unhandled SQL in fake db: ${compact}`);
  };

  return {
    calls,
    state,
    async query(sql, params) {
      return execute(sql, params);
    },
    async connect() {
      return {
        async query(sql, params) {
          return execute(sql, params);
        },
        release() {},
      };
    },
  };
};

test('issues access on first join, ignoring legacy room values and provisioning a deterministic room', async () => {
  const db = createFakeDb(makeState({
    booking: { video_room_id: 'legacy-room-value' },
    videoSession: null,
    participant: null,
  }));

  const createRoomCalls = [];
  const createTokenCalls = [];
  const service = new VideoSessionService({
    db,
    now: () => new Date('2026-08-22T09:55:00.000Z'),
    providerFactory: () => ({
      async createRoom(input) {
        createRoomCalls.push(input);
        return { roomName: input.roomName };
      },
      async createToken(input) {
        createTokenCalls.push(input);
        return {
          roomUrl: `https://shura.daily.co/${input.roomName}`,
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
  assert.equal(access.accessToken, 'daily.jwt.token');
  assert.equal(createRoomCalls.length, 1);
  assert.equal(createTokenCalls.length, 1);
  assert.ok(createRoomCalls[0].roomName.startsWith('shura-'));
  assert.notEqual(createRoomCalls[0].roomName, 'legacy-room-value');
  assert.equal(createTokenCalls[0].roomName, createRoomCalls[0].roomName);
  assert.equal(db.state.booking.video_room_id, createRoomCalls[0].roomName);
  assert.equal(db.state.videoSession.status, 'ready');
});

test('returns VIDEO_PROVISIONING while a fresh provisioning claim is active', async () => {
  const db = createFakeDb(makeState({
    booking: { video_room_id: null },
    videoSession: {
      id: 101,
      booking_id: 33,
      status: 'provisioning',
      updated_at: new Date('2026-08-22T09:59:30.000Z'),
    },
    participant: null,
  }));

  let createRoomCalled = false;
  const service = new VideoSessionService({
    db,
    now: () => new Date('2026-08-22T10:00:00.000Z'),
    providerFactory: () => ({
      async createRoom() {
        createRoomCalled = true;
        return {};
      },
      async createToken() {
        throw new Error('not reached');
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
      && error.code === 'VIDEO_PROVISIONING'
  );
  assert.equal(createRoomCalled, false);
});

test('recovers stale provisioning claims and proceeds with deterministic reprovision', async () => {
  const db = createFakeDb(makeState({
    booking: { video_room_id: null },
    videoSession: {
      id: 101,
      booking_id: 33,
      status: 'provisioning',
      updated_at: new Date('2026-08-22T09:40:00.000Z'),
    },
    participant: null,
  }));

  let roomName = null;
  const service = new VideoSessionService({
    db,
    now: () => new Date('2026-08-22T10:00:00.000Z'),
    providerFactory: () => ({
      async createRoom(input) {
        roomName = input.roomName;
        return { roomName: input.roomName };
      },
      async createToken(input) {
        return {
          roomUrl: `https://shura.daily.co/${input.roomName}`,
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
  });

  assert.equal(access.mode, 'video');
  assert.ok(roomName && roomName.startsWith('shura-'));
  assert.equal(db.state.videoSession.status, 'ready');
  assert.equal(db.state.booking.video_room_id, roomName);
});

test('returns uniform 403 for missing bookings and disallowed roles', async () => {
  const db = createFakeDb(makeState());
  const service = new VideoSessionService({
    db,
    providerFactory: () => ({ createToken: async () => ({}) }),
  });

  await assert.rejects(
    () => service.issueParticipantAccess({
      bookingId: 99,
      principalRole: 'client',
      principalId: 7,
    }),
    (error) => error instanceof VideoSessionServiceError
      && error.status === 403
      && error.code === 'SESSION_ACCESS_DENIED'
  );

  await assert.rejects(
    () => service.issueParticipantAccess({
      bookingId: 33,
      principalRole: 'admin',
      principalId: 1,
    }),
    (error) => error instanceof VideoSessionServiceError
      && error.status === 403
      && error.code === 'SESSION_ACCESS_DENIED'
  );
});

test('maps provider not configured errors to stable public 503 codes', async () => {
  const db = createFakeDb(makeState({
    booking: { video_room_id: null },
    videoSession: null,
  }));

  const service = new VideoSessionService({
    db,
    now: () => new Date('2026-08-22T09:55:00.000Z'),
    providerFactory: () => ({
      async createRoom() {
        throw new VideoProviderNotConfiguredError();
      },
      async createToken() {
        throw new Error('not reached');
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
