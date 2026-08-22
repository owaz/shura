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
const STALE_PROVISIONING_MS = 2 * 60 * 1000;

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
    videoSessionUpdatedAt: row.video_session_updated_at || null,
    participantProviderUserId: row.participant_provider_user_id || null,
    participantPreviouslyJoined: Boolean(row.participant_first_joined_at) || Number(row.participant_connection_count || 0) > 0,
    otherParticipantJoined: Boolean(row.other_participant_joined),
    hasPaidPayment: Boolean(row.has_paid_payment),
    refundBlocked: Boolean(row.refund_blocked),
  };
};

const trustedRoomName = ({ bookingId, videoSessionId, scheduledAt, videoRoomId }) => {
  if (!bookingId || !videoSessionId || !scheduledAt || !videoRoomId) return null;
  const expected = buildDeterministicRoomName({ bookingId, videoSessionId, scheduledAt });
  return videoRoomId === expected ? expected : null;
};

class VideoSessionService {
  constructor({ db = pool, providerFactory = () => getVideoProvider(), now = () => new Date() } = {}) {
    this.db = db;
    this.providerFactory = providerFactory;
    this.now = now;
  }

  async getSessionState({ bookingId, principalRole, principalId }) {
    const context = await this.resolveAuthorizedContext({ bookingId, principalRole, principalId });
    const evaluation = evaluateVideoJoinPredicate({
      role: normalizeLower(principalRole),
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

    const join = {
      allowed: evaluation.allowed,
      reason: evaluation.allowed ? null : evaluation.code,
      opensAt: evaluation.details?.join?.opensAt || null,
      closesAt: evaluation.details?.join?.closesAt || null,
      reconnectUntil: evaluation.details?.join?.reconnectUntil || null,
      hardEndsAt: evaluation.details?.join?.hardEndsAt || null,
    };

    return {
      bookingId: context.bookingId,
      mode: context.sessionType,
      videoStatus: context.videoStatus,
      join,
      presence: {
        selfJoined: context.participantPreviouslyJoined,
        otherParticipantJoined: context.otherParticipantJoined,
      },
    };
  }

  async signalLeave({ bookingId, principalRole, principalId }) {
    await this.resolveAuthorizedContext({ bookingId, principalRole, principalId });
    return { acknowledged: true };
  }

  async issueParticipantAccess({
    bookingId,
    principalRole,
    principalId,
    participantName = null,
  }) {
    const role = normalizeLower(principalRole);
    const resolvedPrincipalId = parsePositiveInteger(principalId);
    let context = await this.resolveAuthorizedContext({
      bookingId,
      principalRole: role,
      principalId: resolvedPrincipalId,
    });

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
        bookingId: context.bookingId,
        principalRole: role,
        principalId: resolvedPrincipalId,
      });
      context = await this.loadJoinContext({
        bookingId: context.bookingId,
        principalRole: role,
        principalId: resolvedPrincipalId,
      });
      if (!context) throw accessDeniedError();
    }

    const expectedRoomName = buildDeterministicRoomName({
      bookingId: context.bookingId,
      videoSessionId: context.videoSessionId,
      scheduledAt: context.scheduledAt,
    });
    context.videoRoomId = trustedRoomName({
      bookingId: context.bookingId,
      videoSessionId: context.videoSessionId,
      scheduledAt: context.scheduledAt,
      videoRoomId: context.videoRoomId,
    });

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
        expectedRoomName,
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

  async resolveAuthorizedContext({ bookingId, principalRole, principalId }) {
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

    const context = await this.loadJoinContext({
      bookingId: resolvedBookingId,
      principalRole: role,
      principalId: resolvedPrincipalId,
    });
    if (!context) throw accessDeniedError();
    return context;
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
              vs.updated_at AS video_session_updated_at,
              vp.provider_user_id AS participant_provider_user_id,
              vp.first_joined_at AS participant_first_joined_at,
              vp.connection_count AS participant_connection_count,
              COALESCE(presence_flags.other_participant_joined, FALSE) AS other_participant_joined,
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
        SELECT BOOL_OR(
          participant.first_joined_at IS NOT NULL
          OR COALESCE(participant.connection_count, 0) > 0
        ) AS other_participant_joined
        FROM video_participants participant
        WHERE participant.video_session_id = vs.id
          AND participant.principal_role <> $2
       ) presence_flags ON TRUE
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
    expectedRoomName,
    scheduledAt,
    durationMinutes,
    sessionType,
  }) {
    const claimResult = await this.claimProvisioning({
      bookingId,
      principalRole,
      principalId,
      videoSessionId,
      expectedRoomName,
    });

    if (claimResult.videoRoomId) return claimResult.videoRoomId;
    if (claimResult.pending) {
      throw new VideoSessionServiceError({
        status: 503,
        code: 'VIDEO_PROVISIONING',
        message: 'Session provisioning is in progress. Please retry in a moment.',
      });
    }

    const roomName = expectedRoomName;
    const provider = this.providerFactory();
    try {
      await provider.createRoom({
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
      roomName,
    });

    return persistedRoomName;
  }

  async claimProvisioning({ bookingId, principalRole, principalId, videoSessionId, expectedRoomName }) {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `SELECT b.video_room_id, vs.id AS video_session_id, LOWER(COALESCE(vs.status, '')) AS video_status,
                vs.updated_at AS video_session_updated_at
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

      if (locked.video_room_id && locked.video_room_id === expectedRoomName) {
        await client.query('COMMIT');
        return { videoRoomId: locked.video_room_id, pending: false };
      }

      let currentStatus = normalizeLower(locked.video_status || 'scheduled');

      if (locked.video_room_id && locked.video_room_id !== expectedRoomName && currentStatus === 'ready') {
        const reset = await updateVideoSessionStatus(
          {
            videoSessionId,
            status: 'scheduled',
            statusReason: 'room_reference_replaced',
            expectedCurrentStatuses: ['ready'],
          },
          client
        );
        if (!reset) {
          await client.query('COMMIT');
          return { videoRoomId: null, pending: true };
        }
        currentStatus = 'scheduled';
      }

      if (currentStatus === 'provisioning') {
        const updatedAt = locked.video_session_updated_at ? new Date(locked.video_session_updated_at) : null;
        const staleProvisioning = !updatedAt || Number.isNaN(updatedAt.getTime())
          ? true
          : (this.now().getTime() - updatedAt.getTime()) >= STALE_PROVISIONING_MS;
        if (!staleProvisioning) {
          await client.query('COMMIT');
          return { videoRoomId: null, pending: true };
        }

        const markedFailed = await updateVideoSessionStatus(
          {
            videoSessionId,
            status: 'failed',
            statusReason: 'provisioning_stale_recovery',
            expectedCurrentStatuses: ['provisioning'],
          },
          client
        );
        if (!markedFailed) {
          await client.query('COMMIT');
          return { videoRoomId: null, pending: true };
        }

        const reclaimed = await updateVideoSessionStatus(
          {
            videoSessionId,
            status: 'provisioning',
            statusReason: 'first_join_recovered',
            expectedCurrentStatuses: ['failed'],
          },
          client
        );
        await client.query('COMMIT');
        return { videoRoomId: null, pending: !reclaimed };
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

      if (locked.video_room_id && locked.video_room_id === roomName) {
        await client.query('COMMIT');
        return locked.video_room_id;
      }

      await client.query(
        `UPDATE bookings
         SET video_room_id = $1, updated_at = NOW()
         WHERE id = $2`,
        [roomName, bookingId]
      );

      const markedReady = await updateVideoSessionStatus(
        {
          videoSessionId,
          status: 'ready',
          statusReason: null,
          expectedCurrentStatuses: ['provisioning'],
        },
        client
      );
      if (!markedReady) {
        throw new VideoSessionServiceError({
          status: 503,
          code: 'VIDEO_PROVISIONING',
          message: 'Session provisioning is in progress. Please retry in a moment.',
        });
      }
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
