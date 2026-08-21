const crypto = require('crypto');
const express = require('express');
const pool = require('../db');
const { DELIVERY_EVENTS, applyDeliveryEvent } = require('../utils/emailOutbox');

const router = express.Router();

const verifySignature = (req) => {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const id = req.headers['svix-id'];
  const timestamp = req.headers['svix-timestamp'];
  const signatures = String(req.headers['svix-signature'] || '').split(' ');
  if (!secret || !id || !timestamp || !req.rawBody) return false;
  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;
  if (Math.abs(Date.now() - timestampSeconds * 1000) > 5 * 60 * 1000) return false;
  const signedContent = `${id}.${timestamp}.${req.rawBody.toString('utf8')}`;
  const expected = crypto
    .createHmac('sha256', Buffer.from(secret.replace(/^whsec_/, ''), 'base64'))
    .update(signedContent)
    .digest('base64');
  return signatures.some((signature) => {
    const provided = signature.replace(/^v1,/, '');
    return provided.length === expected.length
      && crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  });
};

const providerEventTime = (req) => {
  const value = req.body?.created_at || req.body?.data?.created_at;
  const parsed = value ? new Date(value) : new Date(Number(req.headers['svix-timestamp']) * 1000);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

router.post('/', async (req, res) => {
  if (!verifySignature(req)) return res.status(401).json({ error: 'Invalid webhook signature' });
  const eventId = req.headers['svix-id'];
  const eventType = req.body?.type;
  if (!DELIVERY_EVENTS[eventType]) return res.status(200).json({ ok: true, ignored: true });
  const emailId = req.body?.data?.email_id;
  const occurredAt = providerEventTime(req);
  if (!emailId || !occurredAt) return res.status(400).json({ error: 'Invalid webhook payload' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query(
      `INSERT INTO email_webhook_events
        (event_id, event_type, provider_message_id, provider_event_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (event_id) DO NOTHING`,
      [eventId, eventType, emailId, occurredAt]
    );
    if (inserted.rowCount === 0) {
      await client.query('COMMIT');
      return res.status(200).json({ ok: true, duplicate: true });
    }
    await applyDeliveryEvent(client, emailId, eventType, occurredAt);
    await client.query('COMMIT');
    return res.status(200).json({ ok: true });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Resend webhook processing failed:', error.message);
    return res.status(500).json({ error: 'Webhook processing failed' });
  } finally {
    client.release();
  }
});

module.exports = router;
