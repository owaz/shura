const test = require('node:test');
const assert = require('node:assert/strict');
const { applyWebhookEvent, processWebhookQueue, startVideoReconciliationWorker } = require('../utils/videoReconciliationWorker');

const originalVideoProvider = process.env.VIDEO_PROVIDER;
const originalWorkerEnabled = process.env.VIDEO_RECONCILIATION_WORKER_ENABLED;

test.afterEach(() => {
  if (originalVideoProvider === undefined) delete process.env.VIDEO_PROVIDER;
  else process.env.VIDEO_PROVIDER = originalVideoProvider;

  if (originalWorkerEnabled === undefined) delete process.env.VIDEO_RECONCILIATION_WORKER_ENABLED;
  else process.env.VIDEO_RECONCILIATION_WORKER_ENABLED = originalWorkerEnabled;
});

test('processes out-of-order meeting.started without regressing a terminal session', async () => {
  let currentStatus = 'ended';
  let processed = 0;
  let failed = 0;

  const claimFn = async () => ([
    {
      provider: 'daily',
      provider_event_id: 'evt-out-of-order',
      attempt_count: 1,
      event_type: 'meeting.started',
      provider_room_name: 'room-alpha',
      event_occurred_at: new Date('2026-08-22T10:00:00.000Z'),
    },
  ]);

  const summary = await processWebhookQueue({
    queryable: {},
    claimFn,
    markProcessedFn: async () => {
      processed += 1;
      return { ok: true };
    },
    markFailedFn: async () => {
      failed += 1;
      return { ok: true };
    },
    applyWebhookEventFn: async (event) => applyWebhookEvent(event, {
      loadSessionContextByRoomFn: async () => ({ video_session_id: 12, video_status: currentStatus }),
      loadVideoParticipantByProviderUserIdFn: async () => null,
      updateVideoSessionStatusFn: async ({ status, expectedCurrentStatuses }) => {
        if (!expectedCurrentStatuses.includes(currentStatus)) return null;
        currentStatus = status;
        return { id: 12, status: currentStatus };
      },
      markParticipantJoinedFn: async () => null,
      markParticipantLeftFn: async () => null,
    }),
  });

  assert.equal(summary.claimed, 1);
  assert.equal(summary.processed, 1);
  assert.equal(summary.failed, 0);
  assert.equal(processed, 1);
  assert.equal(failed, 0);
  assert.equal(currentStatus, 'ended');
});

test('video reconciliation worker drains an active run before stopping', async () => {
  process.env.VIDEO_PROVIDER = 'daily';
  process.env.VIDEO_RECONCILIATION_WORKER_ENABLED = 'true';

  let resolveRun;
  let runCount = 0;
  let stopResolved = false;

  const worker = startVideoReconciliationWorker({
    runCycle: async () => {
      runCount += 1;
      await new Promise((resolve) => { resolveRun = resolve; });
    },
    setIntervalFn: () => ({ unref() {} }),
    clearIntervalFn: () => {},
  });

  await new Promise(setImmediate);
  assert.equal(runCount, 1);

  const stopPromise = worker.stop().then(() => { stopResolved = true; });
  await new Promise(setImmediate);
  assert.equal(stopResolved, false);

  resolveRun();
  await stopPromise;
  assert.equal(stopResolved, true);
});
