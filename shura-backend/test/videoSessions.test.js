const test = require('node:test');
const assert = require('node:assert/strict');

const {
  VIDEO_SESSION_TERMINAL_STATUSES,
  VIDEO_STATUS_TRANSITIONS,
  claimVideoWebhookEvents,
  createVideoSession,
  enqueueVideoWebhookEvent,
  markParticipantJoined,
  markParticipantLeft,
  markVideoWebhookFailed,
  markVideoWebhookProcessed,
  updateVideoSessionStatus,
  upsertVideoParticipant,
} = require('../db/videoSessions');

test('createVideoSession uses supplied queryable and enforces positive booking ids', async () => {
  await assert.rejects(
    () => createVideoSession({ bookingId: 0 }, { query: async () => ({ rows: [] }) }),
    /bookingId must be a positive integer/
  );

  let call;
  const queryable = {
    async query(sql, params) {
      call = { sql, params };
      return { rows: [{ id: 10, booking_id: 55, status: 'scheduled' }] };
    },
  };
  const row = await createVideoSession({ bookingId: 55 }, queryable);

  assert.equal(row.id, 10);
  assert.equal(call.params[0], 55);
  assert.match(call.sql, /ON CONFLICT \(booking_id\) DO UPDATE/);
});

test('updateVideoSessionStatus applies compare-and-set transition guards', async () => {
  let call;
  const queryable = {
    async query(sql, params) {
      call = { sql, params };
      return { rows: [{ id: 4, status: 'provisioning' }] };
    },
  };

  const row = await updateVideoSessionStatus(
    { videoSessionId: 4, status: 'provisioning', statusReason: 'first_join' },
    queryable
  );

  assert.equal(row.status, 'provisioning');
  assert.deepEqual(call.params[5], VIDEO_STATUS_TRANSITIONS.provisioning);
  assert.deepEqual(call.params[6], VIDEO_SESSION_TERMINAL_STATUSES);
  assert.match(call.sql, /status = ANY\(\$6::text\[\]\)/);
});

test('updateVideoSessionStatus rejects disallowed transition source status overrides', async () => {
  await assert.rejects(
    () => updateVideoSessionStatus(
      {
        videoSessionId: 2,
        status: 'ready',
        expectedCurrentStatuses: ['scheduled'],
      },
      { query: async () => ({ rows: [] }) }
    ),
    /Transition to ready is not allowed from scheduled/
  );
});

test('updateVideoSessionStatus accepts source-status subset overrides', async () => {
  let params;
  const queryable = {
    async query(_sql, values) {
      params = values;
      return { rows: [{ id: 2, status: 'cancelled' }] };
    },
  };

  await updateVideoSessionStatus(
    {
      videoSessionId: 2,
      status: 'cancelled',
      expectedCurrentStatuses: ['ready', 'rejoinable'],
    },
    queryable
  );

  assert.deepEqual(params[5], ['ready', 'rejoinable']);
});

test('upsertVideoParticipant preserves provider identity on conflict', async () => {
  let call;
  const queryable = {
    async query(sql, params) {
      call = { sql, params };
      return { rows: [{ id: 9, provider_user_id: 'existing-provider-id' }] };
    },
  };
  await upsertVideoParticipant(
    {
      videoSessionId: 9,
      principalRole: 'client',
      principalId: 77,
      providerUserId: 'new-provider-id',
    },
    queryable
  );

  assert.match(call.sql, /ON CONFLICT \(video_session_id, principal_role, principal_id\) DO UPDATE/);
  assert.doesNotMatch(call.sql, /provider_user_id = EXCLUDED\.provider_user_id/);
});

test('enqueueVideoWebhookEvent reports duplicates without throwing', async () => {
  const duplicateQueryable = { query: async () => ({ rows: [] }) };
  const duplicate = await enqueueVideoWebhookEvent(
    {
      provider: 'daily',
      providerEventId: 'evt_1',
      eventType: 'participant.joined',
    },
    duplicateQueryable
  );
  assert.deepEqual(duplicate, { queued: false, duplicate: true });
});

test('claimVideoWebhookEvents reclaims stale processing rows with an explicit lease', async () => {
  let call;
  const queryable = {
    async query(sql, params) {
      call = { sql, params };
      return { rows: [{ provider: 'daily', provider_event_id: 'evt_1' }] };
    },
  };

  const rows = await claimVideoWebhookEvents(5, queryable, 120);
  assert.equal(rows.length, 1);
  assert.deepEqual(call.params, [5, 120]);
  assert.match(call.sql, /processing_status IN \('pending', 'failed', 'processing'\)/);
  assert.match(call.sql, /next_attempt_at = NOW\(\) \+ \(\$2 \* INTERVAL '1 second'\)/);
});

test('markVideoWebhookFailed requires retry scheduling input', async () => {
  await assert.rejects(
    () => markVideoWebhookFailed(
      {
        provider: 'daily',
        providerEventId: 'evt_2',
        expectedAttemptCount: 1,
        errorCode: 'TRANSIENT',
      },
      { query: async () => ({ rows: [] }) }
    ),
    /nextAttemptAt is required/
  );
});

test('markVideoWebhookProcessed uses attempt compare-and-set and no-ops stale workers', async () => {
  let call;
  const queryable = {
    async query(sql, params) {
      call = { sql, params };
      return { rows: [] };
    },
  };

  const row = await markVideoWebhookProcessed(
    {
      provider: 'daily',
      providerEventId: 'evt_3',
      expectedAttemptCount: 4,
    },
    queryable
  );

  assert.equal(row, null);
  assert.equal(call.params[3], 4);
  assert.match(call.sql, /processing_status = 'processing'/);
  assert.match(call.sql, /attempt_count = \$4/);
});

test('markVideoWebhookFailed requires attempt compare-and-set input', async () => {
  await assert.rejects(
    () => markVideoWebhookFailed(
      {
        provider: 'daily',
        providerEventId: 'evt_4',
        errorCode: 'TRANSIENT',
        nextAttemptAt: new Date(),
      },
      { query: async () => ({ rows: [] }) }
    ),
    /expectedAttemptCount must be a positive integer/
  );
});

test('markVideoWebhookFailed uses attempt compare-and-set guard', async () => {
  let call;
  const queryable = {
    async query(sql, params) {
      call = { sql, params };
      return { rows: [] };
    },
  };

  const row = await markVideoWebhookFailed(
    {
      provider: 'daily',
      providerEventId: 'evt_5',
      expectedAttemptCount: 2,
      errorCode: 'TRANSIENT',
      nextAttemptAt: new Date('2026-01-01T00:00:00.000Z'),
    },
    queryable
  );

  assert.equal(row, null);
  assert.equal(call.params[4], 2);
  assert.match(call.sql, /processing_status = 'processing'/);
  assert.match(call.sql, /attempt_count = \$5/);
});

test('participant presence updates are additive and timestamped', async () => {
  const queries = [];
  const queryable = {
    async query(sql, params) {
      queries.push({ sql, params });
      return { rows: [{ id: 5 }] };
    },
  };

  await markParticipantJoined({ videoParticipantId: 5 }, queryable);
  await markParticipantLeft({ videoParticipantId: 5, connectedSeconds: 42 }, queryable);

  assert.match(queries[0].sql, /connection_count = connection_count \+ 1/);
  assert.match(queries[1].sql, /total_connected_seconds = total_connected_seconds \+ COALESCE\(\$3, 0\)/);
  assert.equal(queries[1].params[2], 42);
});
