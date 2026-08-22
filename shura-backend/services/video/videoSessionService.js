const crypto = require('crypto');
const pool = require('../../db');
const {
  createVideoSession,
  recordVideoSessionError,
  updateVideoSessionStatus,
  upsertVideoParticipant,
} = require('../../db/videoSessions');
const {
  VideoProviderError,
  VideoProviderNotConfiguredError,
  getVideoProvider,
} = require('./videoProvider');
const {
  JOINABLE_SESSION_TYPES,
  TERMINAL_VIDEO_STATUSES,
  evaluateVideoJoinPredicate,
} = require('../../utils/videoJoinPolicy');

const ALLOWED_JOIN_ROLES = new Set(['client', 'therapist']);

class VideoSessionServiceError extends Error {
  constructor({ status = 500, code = 'SESSION_JOIN_FAILED', message = 'We could not open your session.', details = null } = {}) {
    super(message);
    this.name = 'VideoSessionServiceError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const normalizeLower = (value) => String(value || '').trim().toLowerCase();

const parsePositiveInteger = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

const isBase64 = (value) => typeof value === 'string' && /^[A-Za-z0-9+/]+={0,2}$/.test(value) && value.length % 4 === 0;

const deriveRoomNameKey = () => {
  const raw = String(process.env.DAILY_WEBHOOK_HMAC || process.env.DAILY_API_KEY || '').trim();
  if (!raw) return Buffer.from('shura-video-room-key', 'utf8');
  if (isBase64(raw)) {
    try {
      return Buffer.from(raw, 'base64');
    } catch {
      return Buffer.from(raw, 'utf8');
    }
  }
  return Buffer.from(raw, 'utf8');
};

const buildDeterministicRoomName = ({ bookingId, videoSessionId, scheduledAt }) => {
  const seed = `${videoSessionId}:${bookingId}:${new Date(scheduledAt).toISOString()}`;
  const digest = crypto
    .createHmac('sha256', deriveRoomNameKey())
    .update(seed)
    .digest('hex');
  return `shura-${digest.slice(0, 32)}`;
};

const participantDisplayName = (role, rawName) => {
  const fallback = role === 'therapist' ? 'Therapist' : 'Client';
  const value = String(rawName || '').trim();
  if (!value || value.includes('@')) return fallback;
  const firstWord = value.split(/\s+/)[0].trim();
  return firstWord || fallback;
};

const providerFailureToServiceError = (error) => {
  if (error instanceof VideoProviderNotConfiguredError || error?.code === 'NOT_CONFIGURED') {
    return new VideoSessionServiceError({
      status: 503,
      code: 'VIDEO_PROVIDER_NOT_CONFIGURED',
      message: 'Secure session joining is not configured yet.',
    });
  }
  if (error instanceof VideoProviderError && error.code === 'RATE_LIMITED') {
    return new VideoSessionServiceError({
      status: 429,
      code: 'VIDEO_JOIN_RATE_LIMITED',
      message: 'Too many join attempts are happening right now. Please retry shortly.',
    });
  }
  if (error instanceof VideoProviderError) {
    return new VideoSessionServiceError({
      status: 503,
      code: 'VIDEO_PROVIDER_UNAVAILABLE',
      message: 'Secure session joining is temporarily unavailable.',
    });
  }
  return null;
};

const accessDeniedError = () => new VideoSessionServiceError({
  status: 403,
  code: 'SESSION_ACCESS_DENIED',
  message: 'You do not have access to this session.',
});

const toJoinContext = (row) => {
  if (!row) return null;
  return {
    bookingId: Number(row.booking_id),
    principalClientId: Number(row.user_id),
    principalTherapistId: Number(row.therapist_id),
    scheduledAt: row.scheduled_at,
    durationMinutes: Number(row.duration_minutes || 50),
    sessionType: normalizeLower(row.session_type),
    bookingStatus: normalizeLower(row.booking_status),
    paymentKind: normalizeLower(row.payment_kind),
    videoRoomId: row.video_room_id || null,
    videoSessionId: row.video_session_id ? Number(row.video_session_id) : null,
    videoStatus: normalizeLower(row.video_status || 'scheduled'),
    participantProviderUserId: row.participant_provider_user_id || null,
    participantPreviouslyJoined: Boolean(row.participant_first_joined_at) || Number(row.participant_connection_count || 0) > 0,
    hasPaidPayment: Boolean(row.has_paid_payment),
    refundBlocked: Boolean(row.refund_blocked),
  };
};

class VideoSessionService {
  constructor({ db = pool, providerFactory = () => getVideoProvider(), now = () => new Date() } = {}) {
    this.db = db;
    this.providerFactory = providerFactory;
    this.now = now;
  }

  async issueParticipantAccess({
    bookingId,
    principalRole,
    principalId,
    participantName = null,
  }) {
    const resolvedBookingId = parsePositiveInteger(bookingId);
    if (!resolvedBookingId) {
      throw new VideoSessionServiceError({
        status: 400,
        code: 'INVALID_BOOKING_ID',
        message: 'Choose a valid booking.',
      });
    }

    const role = normalizeLower(principalRole);
    const resolvedPrincipalId = parsePositiveInteger(principalId);
    if (!ALLOWED_JOIN_ROLES.has(role) || !resolvedPrincipalId) {
      throw accessDeniedError();
    }

    let context = await this.loadJoinContext({
      bookingId: resolvedBookingId,
      principalRole: role,
      principalId: resolvedPrincipalId,
    });
    if (!context) throw accessDeniedError();

    if (!JOINABLE_SESSION_TYPES.has(context.sessionType)) {
      const unsupported = evaluateVideoJoinPredicate({
        role,
        bookingStatus: context.bookingStatus,
        sessionType: context.sessionType,
        paymentKind: context.paymentKind,
        hasPaidPayment: context.hasPaidPayment,
        refundBlocked: context.refundBlocked,
        scheduledAt: context.scheduledAt,
        durationMinutes: context.durationMinutes,
        videoStatus: context.videoStatus,
        participantPreviouslyJoined: context.participantPreviouslyJoined,
        now: this.now(),
      });
      throw new VideoSessionServiceError({
        status: unsupported.httpStatus,
        code: unsupported.code,
        message: unsupported.message,
        details: unsupported.details,
      });
    }

    if (!context.videoSessionId) {
      await this.ensureVideoSession({
        bookingId: resolvedBookingId,
        principalRole: role,
        principalId: resolvedPrincipalId,
      });
      context = await this.loadJoinContext({
        bookingId: resolvedBookingId,
        principalRole: role,
        principalId: resolvedPrincipalId,
      });
      if (!context) throw accessDeniedError();
    }

    const evaluation = evaluateVideoJoinPredicate({
      role,
      bookingStatus: context.bookingStatus,
      sessionType: context.sessionType,
      paymentKind: context.paymentKind,
      hasPaidPayment: context.hasPaidPayment,
      refundBlocked: context.refundBlocked,
      scheduledAt: context.scheduledAt,
      durationMinutes: context.durationMinutes,
      videoStatus: context.videoStatus,
      participantPreviouslyJoined: context.participantPreviouslyJoined,
      now: this.now(),
    });

    if (!evaluation.allowed) {
      throw new VideoSessionServiceError({
        status: evaluation.httpStatus,
        code: evaluation.code,
        message: evaluation.message,
        details: evaluation.details,
      });
    }

    if (!context.videoRoomId) {
      context.videoRoomId = await this.provisionRoomIfNeeded({
        bookingId: context.bookingId,
        principalRole: role,
        principalId: resolvedPrincipalId,
        videoSessionId: context.videoSessionId,
        scheduledAt: context.scheduledAt,
        durationMinutes: context.durationMinutes,
        sessionType: context.sessionType,
      });
    }

    const providerUserId = await this.ensureParticipantIdentity({
      videoSessionId: context.videoSessionId,
      principalRole: role,
      principalId: resolvedPrincipalId,
      existingProviderUserId: context.participantProviderUserId,
    });

    const provider = this.providerFactory();
    const displayName = participantDisplayName(role, participantName);
    let token;
    try {
      token = await provider.createToken({
        roomName: context.videoRoomId,
        role,
        participantUserId: providerUserId,
        participantDisplayName: displayName,
        sessionMode: context.sessionType,
        scheduledAt: context.scheduledAt,
        durationMinutes: context.durationMinutes,
      });
    } catch (error) {
      const mappedError = providerFailureToServiceError(error);
      if (mappedError) throw mappedError;
      throw error;
    }

    return {
      mode: context.sessionType,
      roomUrl: token.roomUrl,
      accessToken: token.accessToken,
      accessExpiresAt: token.accessExpiresAt,
      hardEndsAt: token.hardEndsAt,
      startVideoOff: token.startVideoOff,
    };
  }

  async loadJoinContext({ bookingId, principalRole, principalId }, queryable = this.db) {
    const { rows } = await queryable.query(
      `SELECT b.id AS booking_id,
              b.user_id,
              b.therapist_id,
              b.scheduled_at,
              b.duration_minutes,
              b.session_type,
              b.status AS booking_status,
              b.payment_kind,
              b.video_room_id,
              vs.id AS video_session_id,
              vs.status AS video_status,
              vp.provider_user_id AS participant_provider_user_id,
              vp.first_joined_at AS participant_first_joined_at,
              vp.connection_count AS participant_connection_count,
              COALESCE(payment_flags.has_paid_payment, FALSE) AS has_paid_payment,
              COALESCE(payment_flags.refund_blocked, FALSE) AS refund_blocked
       FROM bookings b
       LEFT JOIN video_sessions vs
         ON vs.booking_id = b.id
       LEFT JOIN video_participants vp
         ON vp.video_session_id = vs.id
        AND vp.principal_role = $2
        AND vp.principal_id = $3
       LEFT JOIN LATERAL (
         SELECT BOOL_OR(LOWER(COALESCE(p.status, '')) IN ('completed', 'success', 'paid')) AS has_paid_payment,
                BOOL_OR(
                  LOWER(COALESCE(p.status, '')) = 'refunded'
                  OR LOWER(COALESCE(p.refund_status, '')) IN ('pending', 'processed', 'failed')
                ) AS refund_blocked
         FROM payments p
         WHERE p.booking_id = b.id
       ) payment_flags ON TRUE
       WHERE b.id = $1
         AND (
           ($2 = 'client' AND b.user_id = $3)
           OR ($2 = 'therapist' AND b.therapist_id = $3)
         )
       LIMIT 1`,
      [bookingId, principalRole, principalId]
    );
    return toJoinContext(rows[0] || null);
  }

  async ensureVideoSession({ bookingId, principalRole, principalId }) {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const ownership = await client.query(
        `SELECT b.id, LOWER(COALESCE(b.session_type, '')) AS session_type
         FROM bookings b
         WHERE b.id = $1
           AND (
             ($2 = 'client' AND b.user_id = $3)
             OR ($2 = 'therapist' AND b.therapist_id = $3)
           )
         FOR UPDATE OF b`,
        [bookingId, principalRole, principalId]
      );

      if (!ownership.rows.length) {
        await client.query('ROLLBACK');
        throw accessDeniedError();
      }
      const sessionType = normalizeLower(ownership.rows[0].session_type);
      if (!JOINABLE_SESSION_TYPES.has(sessionType)) {
        await client.query('ROLLBACK');
        return null;
      }
      await createVideoSession({ bookingId, status: 'scheduled' }, client);
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async provisionRoomIfNeeded({
    bookingId,
    principalRole,
    principalId,
    videoSessionId,
    scheduledAt,
    durationMinutes,
    sessionType,
  }) {
    const claimResult = await this.claimProvisioning({
      bookingId,
      principalRole,
      principalId,
      videoSessionId,
    });

    if (claimResult.videoRoomId) return claimResult.videoRoomId;
    if (claimResult.pending) {
      throw new VideoSessionServiceError({
        status: 503,
        code: 'VIDEO_PROVISIONING',
        message: 'Session provisioning is in progress. Please retry in a moment.',
      });
    }

    const roomName = buildDeterministicRoomName({ bookingId, videoSessionId, scheduledAt });
    const provider = this.providerFactory();
    let room;
    try {
      room = await provider.createRoom({
        roomName,
        scheduledAt,
        durationMinutes,
        sessionMode: sessionType,
      });
    } catch (error) {
      await this.markProvisioningFailed(videoSessionId, error);
      const mapped = providerFailureToServiceError(error);
      if (mapped) throw mapped;
      throw error;
    }

    const persistedRoomName = await this.persistProvisionedRoom({
      bookingId,
      principalRole,
      principalId,
      videoSessionId,
      roomName: room.roomName || room.id || roomName,
    });

    return persistedRoomName;
  }

  async claimProvisioning({ bookingId, principalRole, principalId, videoSessionId }) {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `SELECT b.video_room_id, vs.id AS video_session_id, LOWER(COALESCE(vs.status, '')) AS video_status
         FROM bookings b
         JOIN video_sessions vs ON vs.booking_id = b.id
         WHERE b.id = $1
           AND (
             ($2 = 'client' AND b.user_id = $3)
             OR ($2 = 'therapist' AND b.therapist_id = $3)
           )
         FOR UPDATE OF b, vs`,
        [bookingId, principalRole, principalId]
      );
      const locked = rows[0];
      if (!locked) {
        await client.query('ROLLBACK');
        throw accessDeniedError();
      }

      if (locked.video_room_id) {
        await client.query('COMMIT');
        return { videoRoomId: locked.video_room_id, pending: false };
      }

      const currentStatus = normalizeLower(locked.video_status || 'scheduled');
      if (currentStatus === 'provisioning') {
        await client.query('COMMIT');
        return { videoRoomId: null, pending: true };
      }

      if (TERMINAL_VIDEO_STATUSES.has(currentStatus)) {
        await client.query('COMMIT');
        throw new VideoSessionServiceError({
          status: 409,
          code: 'SESSION_ENDED',
          message: 'This session has already ended.',
        });
      }

      const claimed = await updateVideoSessionStatus(
        {
          videoSessionId,
          status: 'provisioning',
          statusReason: 'first_join',
          expectedCurrentStatuses: ['scheduled', 'failed'],
        },
        client
      );

      await client.query('COMMIT');
      if (!claimed) return { videoRoomId: null, pending: true };
      return { videoRoomId: null, pending: false };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async persistProvisionedRoom({ bookingId, principalRole, principalId, videoSessionId, roomName }) {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `SELECT b.video_room_id, LOWER(COALESCE(vs.status, '')) AS video_status
         FROM bookings b
         JOIN video_sessions vs ON vs.booking_id = b.id
         WHERE b.id = $1
           AND (
             ($2 = 'client' AND b.user_id = $3)
             OR ($2 = 'therapist' AND b.therapist_id = $3)
           )
         FOR UPDATE OF b, vs`,
        [bookingId, principalRole, principalId]
      );
      const locked = rows[0];
      if (!locked) {
        await client.query('ROLLBACK');
        throw accessDeniedError();
      }

      if (locked.video_room_id) {
        await client.query('COMMIT');
        return locked.video_room_id;
      }

      await client.query(
        `UPDATE bookings
         SET video_room_id = $1, updated_at = NOW()
         WHERE id = $2`,
        [roomName, bookingId]
      );

      await updateVideoSessionStatus(
        {
          videoSessionId,
          status: 'ready',
          statusReason: null,
          expectedCurrentStatuses: ['provisioning'],
        },
        client
      );
      await client.query('COMMIT');
      return roomName;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async markProvisioningFailed(videoSessionId, error) {
    const providerCode = error instanceof VideoProviderError ? error.code : 'VIDEO_PROVIDER_UNAVAILABLE';
    await updateVideoSessionStatus(
      {
        videoSessionId,
        status: 'failed',
        statusReason: 'provider_room_create_failed',
        expectedCurrentStatuses: ['provisioning'],
      },
      this.db
    ).catch(() => {});
    await recordVideoSessionError(
      {
        videoSessionId,
        errorCode: providerCode,
      },
      this.db
    ).catch(() => {});
  }

  async ensureParticipantIdentity({
    videoSessionId,
    principalRole,
    principalId,
    existingProviderUserId,
  }) {
    if (existingProviderUserId) return existingProviderUserId;
    const participant = await upsertVideoParticipant(
      {
        videoSessionId,
        principalRole,
        principalId,
        providerUserId: crypto.randomUUID(),
      },
      this.db
    );
    if (!participant?.provider_user_id) {
      throw new VideoSessionServiceError({
        status: 500,
        code: 'SESSION_JOIN_FAILED',
        message: 'We could not initialize secure participant access.',
      });
    }
    return participant.provider_user_id;
  }
}

const createVideoSessionService = (options = {}) => new VideoSessionService(options);

module.exports = {
  VideoSessionService,
  VideoSessionServiceError,
  createVideoSessionService,
  participantDisplayName,
};
