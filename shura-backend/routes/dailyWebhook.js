const crypto = require('crypto');
const express = require('express');
const { enqueueVideoWebhookEvent } = require('../db/videoSessions');
const { triggerVideoWebhookProcessing } = require('../utils/videoReconciliationWorker');
const { errorResponse } = require('../utils/apiResponse');

const SUPPORTED_EVENT_TYPES = new Set([
  'meeting.started',
  'meeting.ended',
  'participant.joined',
  'participant.left',
]);
const PARTICIPANT_EVENT_TYPES = new Set(['participant.joined', 'participant.left']);
const REPLAY_WINDOW_SECONDS = 5 * 60;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const safeEqual = (left, right) => (
  typeof left === 'string'
  && typeof right === 'string'
  && left.length === right.length
  && crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right))
);

const parseEpochSeconds = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const asDate = new Date(Math.floor(parsed * 1000));
  return Number.isNaN(asDate.getTime()) ? null : asDate;
};

const parseDurationSeconds = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.floor(parsed);
};

const normalizeUuid = (value) => {
  const text = String(value || '').trim();
  return UUID_PATTERN.test(text) ? text : null;
};

const parseJsonBody = (rawBody) => {
  try {
    return JSON.parse(rawBody);
  } catch {
    return null;
  }
};

const hasValidBasicAuth = (req, configuredSecret) => {
  if (!configuredSecret) return true;
  const header = String(req.headers.authorization || '');
  return safeEqual(header, `Basic ${configuredSecret}`);
};

const verifyDailySignature = ({ timestamp, providedSignature, rawBody, hmacSecretBase64, now = Date.now() }) => {
  if (!timestamp || !providedSignature || !rawBody || !hmacSecretBase64) return false;
  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;
  if (Math.abs(now - (timestampSeconds * 1000)) > (REPLAY_WINDOW_SECONDS * 1000)) return false;

  let secret;
  try {
    secret = Buffer.from(hmacSecretBase64, 'base64');
  } catch {
    return false;
  }
  if (!secret.length) return false;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('base64');

  return safeEqual(expectedSignature, String(providedSignature));
};

const isDailyProbePayload = (rawBody) => rawBody === '{"test":"test"}';

const createDailyWebhookRouter = ({
  enqueueWebhookEvent = enqueueVideoWebhookEvent,
  triggerProcessing = triggerVideoWebhookProcessing,
  now = () => Date.now(),
} = {}) => {
  const router = express.Router();

  router.post('/', async (req, res) => {
    const rawBuffer = Buffer.isBuffer(req.body) ? req.body : null;
    if (!rawBuffer) {
      return errorResponse(res, 415, 'INVALID_WEBHOOK_CONTENT_TYPE', 'Webhook requests must use an application/json raw body.');
    }
    const rawBody = rawBuffer.toString('utf8');

    const basicAuthSecret = String(process.env.DAILY_WEBHOOK_BASIC_AUTH || '').trim();
    if (!hasValidBasicAuth(req, basicAuthSecret)) {
      return errorResponse(res, 401, 'INVALID_WEBHOOK_AUTH', 'Webhook authentication failed.');
    }

    if (isDailyProbePayload(rawBody)) {
      return res.status(200).json({ ok: true, probe: true });
    }

    const timestamp = String(req.headers['x-webhook-timestamp'] || '').trim();
    const providedSignature = String(req.headers['x-webhook-signature'] || '').trim();
    const hmacSecretBase64 = String(process.env.DAILY_WEBHOOK_HMAC || '').trim();
    const signatureValid = verifyDailySignature({
      timestamp,
      providedSignature,
      rawBody,
      hmacSecretBase64,
      now: now(),
    });
    if (!signatureValid) {
      return errorResponse(res, 401, 'INVALID_WEBHOOK_SIGNATURE', 'Webhook signature verification failed.');
    }

    const parsedBody = parseJsonBody(rawBody);
    if (!parsedBody) {
      return errorResponse(res, 400, 'INVALID_WEBHOOK_PAYLOAD', 'Webhook payload must be valid JSON.');
    }

    const eventType = String(parsedBody.type || '').trim();
    if (!SUPPORTED_EVENT_TYPES.has(eventType)) {
      return res.status(200).json({ ok: true, ignored: true });
    }

    const eventId = String(parsedBody.id || '').trim();
    if (!eventId) {
      return errorResponse(res, 400, 'INVALID_WEBHOOK_PAYLOAD', 'Webhook event id is required.');
    }

    const payload = parsedBody && typeof parsedBody.payload === 'object' ? parsedBody.payload : {};
    const participantSessionId = String(payload.session_id || '').trim() || null;
    if (PARTICIPANT_EVENT_TYPES.has(eventType) && !participantSessionId) {
      return errorResponse(res, 400, 'INVALID_WEBHOOK_PAYLOAD', 'Participant webhook payload must include session_id.');
    }

    try {
      const queueResult = await enqueueWebhookEvent({
        provider: 'daily',
        providerEventId: eventId,
        eventType,
        providerRoomName: String(payload.room || '').trim() || null,
        providerMeetingId: String(payload.meeting_id || '').trim() || null,
        providerParticipantSessionId: participantSessionId,
        providerUserId: normalizeUuid(payload.user_id),
        eventOccurredAt: parseEpochSeconds(parsedBody.event_ts),
        joinedAt: parseEpochSeconds(payload.joined_at),
        durationSeconds: parseDurationSeconds(payload.duration),
      });
      if (queueResult.queued) {
        triggerProcessing();
      }
      return res.status(200).json({ ok: true, duplicate: queueResult.duplicate });
    } catch (error) {
      console.error('Daily webhook enqueue failed', { code: error?.code || 'DAILY_WEBHOOK_ENQUEUE_FAILED' });
      return errorResponse(res, 500, 'WEBHOOK_PROCESSING_FAILED', 'Webhook event processing failed.');
    }
  });

  return router;
};

const router = createDailyWebhookRouter();

module.exports = router;
module.exports.createDailyWebhookRouter = createDailyWebhookRouter;
module.exports.isDailyProbePayload = isDailyProbePayload;
module.exports.verifyDailySignature = verifyDailySignature;
