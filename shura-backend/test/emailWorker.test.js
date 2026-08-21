const test = require('node:test');
const assert = require('node:assert/strict');
const { startEmailWorker } = require('../utils/emailWorker');

const originalWorkerEnabled = process.env.EMAIL_OUTBOX_WORKER_ENABLED;

test.afterEach(() => {
  if (originalWorkerEnabled === undefined) {
    delete process.env.EMAIL_OUTBOX_WORKER_ENABLED;
  } else {
    process.env.EMAIL_OUTBOX_WORKER_ENABLED = originalWorkerEnabled;
  }
});

test('does not claim messages when the worker is paused', () => {
  process.env.EMAIL_OUTBOX_WORKER_ENABLED = 'false';
  let called = false;

  const controller = startEmailWorker({
    processOutbox: async () => { called = true; },
  });

  assert.equal(controller, null);
  assert.equal(called, false);
});

test('processes immediately and drains the in-flight batch on stop', async () => {
  process.env.EMAIL_OUTBOX_WORKER_ENABLED = 'true';
  let resolveBatch;
  let batchStarted = false;
  let stopResolved = false;
  const timers = [];

  const controller = startEmailWorker({
    processOutbox: async () => {
      batchStarted = true;
      await new Promise((resolve) => { resolveBatch = resolve; });
    },
    setIntervalFn: () => {
      const timer = { unref() {} };
      timers.push(timer);
      return timer;
    },
    clearIntervalFn: () => {},
  });

  await new Promise(setImmediate);
  assert.equal(batchStarted, true);
  assert.equal(timers.length, 1);

  const stopping = controller.stop().then(() => { stopResolved = true; });
  await new Promise(setImmediate);
  assert.equal(stopResolved, false);

  resolveBatch();
  await stopping;
  assert.equal(stopResolved, true);
});
