const pool = require('../db');
const {
  claimVideoWebhookEvents,
  markParticipantJoined,
  markParticipantLeft,
  markVideoWebhookFailed,
  markVideoWebhookProcessed,
  updateVideoSessionStatus,
} = require('../db/videoSessions');
const { getConfiguredVideoProviderName, getVideoProvider } = require('../services/video/videoProvider');

const WORK_INTERVAL_MS = 60_000;
const WEBHOOK_BATCH_LIMIT = 20;
const RECONCILIATION_LIMIT = 50;
const HARD_END_GRACE_MINUTES = 15;
const PROVIDER = 'daily';
const TERMINAL_STATUSES = new Set(['ended', 'cancelled', 'expired']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let scheduledWebhookDrain = null;

const parseDate = (value) => {
  if (!value) return null;
  const asDate = value instanceof Date ? value : new Date(value);
  return Number.isNaN(asDate.getTime()) ? null : asDate;
};

const normalizeErrorCode = (error) => String(error?.code || 'VIDEO_WEBHOOK_PROCESS_FAILED').slice(0, 64);

const retryDelayMsForAttempt = (attemptCount) => {
  const cappedAttempt = Math.max(1, Math.min(Number(attemptCount) || 1, 6));
  return Math.min(5 * 60_000, 5_000 * (2 ** (cappedAttempt - 1)));
};

const normalizeUuid = (value) => {
  const text = String(value || '').trim();
  return UUID_PATTERN.test(text) ? text : null;
};

const loadSessionContextByRoom = async (roomName, queryable = pool) => {
  if (!roomName) return null;
  const { rows } = await queryable.query(
    `SELECT vs.id AS video_session_id,
            vs.status AS video_status,
            b.id AS booking_id,
            b.status AS booking_status,
            b.scheduled_at,
            COALESCE(b.duration_minutes, 50) AS duration_minutes
     FROM bookings b
     JOIN video_sessions vs ON vs.booking_id = b.id
     WHERE b.video_room_id = $1
     LIMIT 1`,
    [roomName]
  );
  return rows[0] || null;
};

const loadVideoParticipantByProviderUserId = async (providerUserId, queryable = pool) => {
  const normalized = normalizeUuid(providerUserId);
  if (!normalized) return null;
  const { rows } = await queryable.query(
    `SELECT id, video_session_id
     FROM video_participants
     WHERE provider_user_id = $1::uuid
     LIMIT 1`,
    [normalized]
  );
  return rows[0] || null;
};

const applyWebhookEvent = async (
  webhookEvent,
  {
    queryable = pool,
    loadSessionContextByRoomFn = loadSessionContextByRoom,
    loadVideoParticipantByProviderUserIdFn = loadVideoParticipantByProviderUserId,
    updateVideoSessionStatusFn = updateVideoSessionStatus,
    markParticipantJoinedFn = markParticipantJoined,
    markParticipantLeftFn = markParticipantLeft,
  } = {}
) => {
  if (!webhookEvent || webhookEvent.provider !== PROVIDER) return;
  const eventType = String(webhookEvent.event_type || '').trim();
  if (!['meeting.started', 'meeting.ended', 'participant.joined', 'participant.left'].includes(eventType)) return;

  const context = await loadSessionContextByRoomFn(webhookEvent.provider_room_name, queryable);
  if (!context || !Number.isInteger(Number(context.video_session_id))) return;
  const videoSessionId = Number(context.video_session_id);

  if (eventType === 'meeting.started') {
    await updateVideoSessionStatusFn(
      {
        videoSessionId,
        status: 'live',
        startedAt: parseDate(webhookEvent.event_occurred_at),
        statusReason: null,
        expectedCurrentStatuses: ['ready', 'rejoinable'],
      },
      queryable
    );
    return;
  }

  if (eventType === 'meeting.ended') {
    await updateVideoSessionStatusFn(
      {
        videoSessionId,
        status: 'rejoinable',
        endedAt: parseDate(webhookEvent.event_occurred_at),
        statusReason: 'meeting_ended',
        expectedCurrentStatuses: ['live'],
      },
      queryable
    );
    return;
  }

  const participant = await loadVideoParticipantByProviderUserIdFn(webhookEvent.provider_user_id, queryable);
  if (!participant || Number(participant.video_session_id) !== videoSessionId) return;

  if (eventType === 'participant.joined') {
    await markParticipantJoinedFn(
      {
        videoParticipantId: Number(participant.id),
        joinedAt: parseDate(webhookEvent.joined_at) || parseDate(webhookEvent.event_occurred_at) || new Date(),
      },
      queryable
    );
    await updateVideoSessionStatusFn(
      {
        videoSessionId,
        status: 'live',
        startedAt: parseDate(webhookEvent.event_occurred_at),
        statusReason: null,
        expectedCurrentStatuses: ['ready', 'rejoinable'],
      },
      queryable
    );
    return;
  }

  await markParticipantLeftFn(
    {
      videoParticipantId: Number(participant.id),
      leftAt: parseDate(webhookEvent.event_occurred_at) || new Date(),
      connectedSeconds: Number.isInteger(webhookEvent.duration_seconds) ? webhookEvent.duration_seconds : null,
    },
    queryable
  );
  await updateVideoSessionStatusFn(
    {
      videoSessionId,
      status: 'rejoinable',
      statusReason: 'participant_left',
      expectedCurrentStatuses: ['live'],
    },
    queryable
  );
};

const processWebhookQueue = async ({
  limit = WEBHOOK_BATCH_LIMIT,
  queryable = pool,
  now = () => new Date(),
  claimFn = claimVideoWebhookEvents,
  markProcessedFn = markVideoWebhookProcessed,
  markFailedFn = markVideoWebhookFailed,
  applyWebhookEventFn = applyWebhookEvent,
} = {}) => {
  const claimedRows = await claimFn(limit, queryable);
  let processed = 0;
  let failed = 0;

  for (const event of claimedRows) {
    try {
      await applyWebhookEventFn(event, { queryable });
      const marked = await markProcessedFn(
        {
          provider: event.provider,
          providerEventId: event.provider_event_id,
          expectedAttemptCount: event.attempt_count,
        },
        queryable
      );
      if (marked) processed += 1;
    } catch (error) {
      failed += 1;
      const nextAttemptAt = new Date(now().getTime() + retryDelayMsForAttempt(event.attempt_count));
      await markFailedFn(
        {
          provider: event.provider,
          providerEventId: event.provider_event_id,
          expectedAttemptCount: event.attempt_count,
          errorCode: normalizeErrorCode(error),
          nextAttemptAt,
        },
        queryable
      ).catch(() => {});
    }
  }

  return { claimed: claimedRows.length, processed, failed };
};

const reconcileVideoStatuses = async ({
  queryable = pool,
  updateVideoSessionStatusFn = updateVideoSessionStatus,
} = {}) => {
  const { rows } = await queryable.query(
    `SELECT vs.id AS video_session_id,
            LOWER(COALESCE(vs.status, '')) AS video_status,
            LOWER(COALESCE(b.status, '')) AS booking_status
     FROM video_sessions vs
     JOIN bookings b ON b.id = vs.booking_id
     WHERE (
       LOWER(COALESCE(vs.status, '')) IN ('scheduled', 'ready', 'rejoinable', 'live')
       AND b.scheduled_at IS NOT NULL
       AND NOW() > b.scheduled_at + make_interval(mins => COALESCE(b.duration_minutes, 50) + $1)
     )
     OR (
       LOWER(COALESCE(vs.status, '')) IN ('scheduled', 'provisioning', 'ready', 'live', 'rejoinable', 'failed')
       AND LOWER(COALESCE(b.status, '')) = 'cancelled'
     )
     ORDER BY vs.updated_at ASC
     LIMIT $2`,
    [HARD_END_GRACE_MINUTES, RECONCILIATION_LIMIT]
  );

  let updated = 0;
  for (const row of rows) {
    const current = row.video_status;
    let target = null;
    let expectedCurrentStatuses = null;
    let statusReason = null;

    if (row.booking_status === 'cancelled') {
      target = 'cancelled';
      expectedCurrentStatuses = ['scheduled', 'provisioning', 'ready', 'live', 'rejoinable', 'failed'];
      statusReason = 'booking_cancelled';
    } else if (current === 'live' || current === 'rejoinable') {
      target = 'ended';
      expectedCurrentStatuses = ['live', 'rejoinable'];
      statusReason = 'hard_end_elapsed';
    } else if (current === 'scheduled' || current === 'ready') {
      target = 'expired';
      expectedCurrentStatuses = ['scheduled', 'ready'];
      statusReason = 'hard_end_elapsed';
    }

    if (!target) continue;
    const changed = await updateVideoSessionStatusFn(
      {
        videoSessionId: Number(row.video_session_id),
        status: target,
        statusReason,
        expectedCurrentStatuses,
      },
      queryable
    );
    if (changed) updated += 1;
  }

  return { scanned: rows.length, updated };
};

const reconcileRooms = async ({
  queryable = pool,
  providerFactory = () => getVideoProvider(),
} = {}) => {
  if (getConfiguredVideoProviderName() !== PROVIDER) return { scanned: 0, cleaned: 0, failed: 0 };

  const { rows } = await queryable.query(
    `SELECT b.id AS booking_id,
            b.video_room_id,
            LOWER(COALESCE(b.status, '')) AS booking_status,
            vs.id AS video_session_id,
            LOWER(COALESCE(vs.status, '')) AS video_status
     FROM bookings b
     JOIN video_sessions vs ON vs.booking_id = b.id
     WHERE b.video_room_id IS NOT NULL
       AND (
         LOWER(COALESCE(b.status, '')) = 'cancelled'
         OR (
           b.scheduled_at IS NOT NULL
           AND NOW() > b.scheduled_at + make_interval(mins => COALESCE(b.duration_minutes, 50) + $1)
         )
       )
     ORDER BY b.updated_at ASC
     LIMIT $2`,
    [HARD_END_GRACE_MINUTES, RECONCILIATION_LIMIT]
  );

  let cleaned = 0;
  let failed = 0;
  const provider = providerFactory();

  for (const row of rows) {
    const roomName = String(row.video_room_id || '').trim();
    if (!roomName) continue;
    try {
      await provider.endSession({ roomName });
      await provider.deleteRoom({ roomName });
      await queryable.query(
        `UPDATE bookings
         SET video_room_id = NULL, updated_at = NOW()
         WHERE id = $1 AND video_room_id = $2`,
        [row.booking_id, roomName]
      );
      cleaned += 1;
    } catch (error) {
      failed += 1;
      console.error('Video room cleanup failed', { code: error?.code || 'VIDEO_ROOM_CLEANUP_FAILED' });
    }

    if (TERMINAL_STATUSES.has(row.video_status)) continue;
    const targetStatus = row.booking_status === 'cancelled' ? 'cancelled' : 'expired';
    const source = targetStatus === 'cancelled'
      ? ['scheduled', 'provisioning', 'ready', 'live', 'rejoinable', 'failed']
      : ['scheduled', 'ready', 'rejoinable'];
    await updateVideoSessionStatus(
      {
        videoSessionId: Number(row.video_session_id),
        status: targetStatus,
        statusReason: targetStatus === 'cancelled' ? 'booking_cancelled' : 'hard_end_elapsed',
        expectedCurrentStatuses: source,
      },
      queryable
    ).catch(() => {});
  }

  return { scanned: rows.length, cleaned, failed };
};

const runVideoReconciliationCycle = async ({
  queryable = pool,
  providerFactory = () => getVideoProvider(),
  now = () => new Date(),
} = {}) => {
  const webhooks = await processWebhookQueue({ queryable, now });
  const statuses = await reconcileVideoStatuses({ queryable });
  const rooms = await reconcileRooms({ queryable, providerFactory });
  return { webhooks, statuses, rooms };
};

const drainVideoWebhookQueue = async ({ queryable = pool, now = () => new Date() } = {}) =>
  processWebhookQueue({ queryable, now });

const triggerVideoWebhookProcessing = () => {
  if (scheduledWebhookDrain) return scheduledWebhookDrain;
  scheduledWebhookDrain = Promise.resolve()
    .then(() => drainVideoWebhookQueue())
    .catch((error) => {
      console.error('Video webhook drain failed', { code: error?.code || 'VIDEO_WEBHOOK_DRAIN_FAILED' });
    })
    .finally(() => {
      scheduledWebhookDrain = null;
    });
  return scheduledWebhookDrain;
};

const startVideoReconciliationWorker = ({
  runCycle = runVideoReconciliationCycle,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
} = {}) => {
  let stopping = false;
  let currentRun = null;
  const enabled = process.env.VIDEO_RECONCILIATION_WORKER_ENABLED !== 'false'
    && getConfiguredVideoProviderName() === PROVIDER;

  const run = () => {
    if (!enabled || stopping || currentRun) return currentRun;
    currentRun = runCycle()
      .catch((error) => {
        console.error('Video reconciliation worker failed', { code: error?.code || 'VIDEO_RECONCILIATION_FAILED' });
      })
      .finally(() => {
        currentRun = null;
      });
    return currentRun;
  };

  void run();
  const interval = setIntervalFn(run, WORK_INTERVAL_MS);
  interval.unref();

  return {
    stop: async () => {
      stopping = true;
      clearIntervalFn(interval);
      if (currentRun) await currentRun;
    },
    runNow: run,
  };
};

module.exports = {
  HARD_END_GRACE_MINUTES,
  WORK_INTERVAL_MS,
  applyWebhookEvent,
  drainVideoWebhookQueue,
  loadSessionContextByRoom,
  loadVideoParticipantByProviderUserId,
  processWebhookQueue,
  reconcileRooms,
  reconcileVideoStatuses,
  runVideoReconciliationCycle,
  startVideoReconciliationWorker,
  triggerVideoWebhookProcessing,
};
