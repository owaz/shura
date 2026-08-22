const crypto = require('crypto');
const express = require('express');
const http = require('http');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createDailyWebhookRouter } = require('../routes/dailyWebhook');

const originalHmac = process.env.DAILY_WEBHOOK_HMAC;
const originalBasicAuth = process.env.DAILY_WEBHOOK_BASIC_AUTH;

const startServer = async (router) => {
  const app = express();
  app.use('/api/webhooks/video/daily', express.raw({ type: 'application/json' }), router);
  app.use(express.json());
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  return {
    server,
    url: `http://127.0.0.1:${port}`,
  };
};

const stopServer = async (server) => new Promise((resolve, reject) => {
  server.close((error) => (error ? reject(error) : resolve()));
});

const signBody = ({ secretBytes, timestamp, rawBody }) => crypto
  .createHmac('sha256', secretBytes)
  .update(`${timestamp}.${rawBody}`)
  .digest('base64');

test.afterEach(() => {
  if (originalHmac === undefined) delete process.env.DAILY_WEBHOOK_HMAC;
  else process.env.DAILY_WEBHOOK_HMAC = originalHmac;

  if (originalBasicAuth === undefined) delete process.env.DAILY_WEBHOOK_BASIC_AUTH;
  else process.env.DAILY_WEBHOOK_BASIC_AUTH = originalBasicAuth;
});

test('accepts a valid signed webhook with raw JSON preserved ahead of global JSON middleware', async () => {
  const secretBytes = Buffer.from('daily-webhook-secret');
  process.env.DAILY_WEBHOOK_HMAC = secretBytes.toString('base64');
  const enqueued = [];
  let triggered = 0;

  const router = createDailyWebhookRouter({
    enqueueWebhookEvent: async (event) => {
      enqueued.push(event);
      return { queued: true, duplicate: false };
    },
    triggerProcessing: () => { triggered += 1; },
  });

  const { server, url } = await startServer(router);
  try {
    const payload = {
      version: '1.0.0',
      type: 'participant.joined',
      id: 'evt-joined-1',
      payload: {
        room: 'room-alpha',
        session_id: 'session-1',
        user_id: '4b1b12b3-9a72-4478-a838-49d81ef78897',
        joined_at: 1708972279.96,
      },
      event_ts: 1708972279.961,
    };
    const rawBody = JSON.stringify(payload, null, 2);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = signBody({ secretBytes, timestamp, rawBody });

    const response = await fetch(`${url}/api/webhooks/video/daily`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-webhook-timestamp': timestamp,
        'x-webhook-signature': signature,
      },
      body: rawBody,
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, duplicate: false });
    assert.equal(triggered, 1);
    assert.equal(enqueued.length, 1);
    assert.equal(enqueued[0].provider, 'daily');
    assert.equal(enqueued[0].eventType, 'participant.joined');
    assert.equal(enqueued[0].providerParticipantSessionId, 'session-1');
    assert.equal(enqueued[0].providerRoomName, 'room-alpha');
  } finally {
    await stopServer(server);
  }
});

test('rejects webhook requests with an invalid signature', async () => {
  process.env.DAILY_WEBHOOK_HMAC = Buffer.from('daily-webhook-secret').toString('base64');
  const router = createDailyWebhookRouter({
    enqueueWebhookEvent: async () => ({ queued: true, duplicate: false }),
    triggerProcessing: () => {},
  });

  const { server, url } = await startServer(router);
  try {
    const response = await fetch(`${url}/api/webhooks/video/daily`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-webhook-timestamp': String(Math.floor(Date.now() / 1000)),
        'x-webhook-signature': 'invalid-signature',
      },
      body: JSON.stringify({ type: 'meeting.started', id: 'evt-invalid', payload: {}, event_ts: Date.now() / 1000 }),
    });
    assert.equal(response.status, 401);
    const body = await response.json();
    assert.equal(body.error.code, 'INVALID_WEBHOOK_SIGNATURE');
  } finally {
    await stopServer(server);
  }
});

test('rejects replayed webhook requests outside the timestamp window', async () => {
  const secretBytes = Buffer.from('daily-webhook-secret');
  process.env.DAILY_WEBHOOK_HMAC = secretBytes.toString('base64');

  const router = createDailyWebhookRouter({
    enqueueWebhookEvent: async () => ({ queued: true, duplicate: false }),
    triggerProcessing: () => {},
  });

  const { server, url } = await startServer(router);
  try {
    const payload = {
      type: 'meeting.started',
      id: 'evt-replay',
      payload: { room: 'room-alpha' },
      event_ts: 1708972279.961,
    };
    const rawBody = JSON.stringify(payload);
    const timestamp = String(Math.floor(Date.now() / 1000) - 600);
    const signature = signBody({ secretBytes, timestamp, rawBody });

    const response = await fetch(`${url}/api/webhooks/video/daily`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-webhook-timestamp': timestamp,
        'x-webhook-signature': signature,
      },
      body: rawBody,
    });
    assert.equal(response.status, 401);
    const body = await response.json();
    assert.equal(body.error.code, 'INVALID_WEBHOOK_SIGNATURE');
  } finally {
    await stopServer(server);
  }
});

test('acknowledges duplicate deliveries without re-triggering asynchronous processing', async () => {
  const secretBytes = Buffer.from('daily-webhook-secret');
  process.env.DAILY_WEBHOOK_HMAC = secretBytes.toString('base64');
  let triggerCount = 0;

  const router = createDailyWebhookRouter({
    enqueueWebhookEvent: async () => ({ queued: false, duplicate: true }),
    triggerProcessing: () => { triggerCount += 1; },
  });

  const { server, url } = await startServer(router);
  try {
    const payload = {
      type: 'participant.left',
      id: 'evt-dupe',
      payload: {
        room: 'room-alpha',
        session_id: 'session-1',
        user_id: '4b1b12b3-9a72-4478-a838-49d81ef78897',
        duration: 22.4,
      },
      event_ts: 1708972302.986,
    };
    const rawBody = JSON.stringify(payload);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = signBody({ secretBytes, timestamp, rawBody });

    const response = await fetch(`${url}/api/webhooks/video/daily`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-webhook-timestamp': timestamp,
        'x-webhook-signature': signature,
      },
      body: rawBody,
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, duplicate: true });
    assert.equal(triggerCount, 0);
  } finally {
    await stopServer(server);
  }
});
