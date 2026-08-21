const crypto = require('crypto');
const express = require('express');
const pool = require('../db');

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

router.post('/', async (req, res) => {
  if (!verifySignature(req)) return res.status(401).json({ error: 'Invalid webhook signature' });
  const eventId = req.headers['svix-id'];
  const eventType = req.body?.type;
  const emailId = req.body?.data?.email_id;
  if (!eventType || !emailId) return res.status(400).json({ error: 'Invalid webhook payload' });

  try {
    const inserted = await pool.query(
      `INSERT INTO email_webhook_events (event_id, event_type)
       VALUES ($1, $2) ON CONFLICT (event_id) DO NOTHING`,
      [eventId, eventType]
    );
    if (inserted.rowCount === 0) return res.status(200).json({ ok: true, duplicate: true });

    const status = {
      'email.delivered': 'sent',
      'email.bounced': 'bounced',
      'email.complained': 'complained',
    }[eventType];
    if (status) {
      await pool.query(
        `UPDATE email_outbox SET status = $1, provider_message_id = $2, updated_at = NOW()
         WHERE provider_message_id = $2`,
        [status, emailId]
      );
    }
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Resend webhook processing failed:', error.message);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;
