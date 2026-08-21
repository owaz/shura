const pool = require('../db');

const MAX_ATTEMPTS = 5;
const MAX_RETRY_DELAY_MS = 60 * 60 * 1000;
const PAYLOAD_RETENTION_DAYS = 30;

const DELIVERY_EVENTS = Object.freeze({
  'email.delivered': { status: 'delivered', timestampColumn: 'delivered_at', priority: 1 },
  'email.bounced': { status: 'bounced', timestampColumn: 'bounced_at', priority: 2 },
  'email.complained': { status: 'complained', timestampColumn: 'complained_at', priority: 3 },
});

const enqueueEmail = async (email, queryable = pool) => {
  const { eventKey, emailType, recipient, sender, subject, html, text } = email;
  if (!eventKey || !emailType || !recipient || !sender || !subject || !html || !text) {
    throw new Error('Missing required email outbox fields');
  }
  const { rows } = await queryable.query(
    `INSERT INTO email_outbox
      (event_key, email_type, recipient, sender, subject, html_body, text_body)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (event_key) DO NOTHING
     RETURNING id`,
    [eventKey, emailType, recipient, sender, subject, html, text]
  );
  return { success: true, queued: true, duplicate: rows.length === 0, id: rows[0]?.id };
};

const claimEmails = async (limit = 20) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE email_outbox
       SET status = 'dead', updated_at = NOW(),
           last_error = COALESCE(last_error, 'Retry attempts exhausted')
       WHERE attempts >= $1
         AND (
           status = 'failed'
           OR (status = 'processing' AND updated_at < NOW() - INTERVAL '15 minutes')
         )`,
      [MAX_ATTEMPTS]
    );
    const { rows } = await client.query(
      `SELECT * FROM email_outbox
       WHERE (status = 'pending' AND next_attempt_at <= NOW())
          OR (status = 'failed' AND attempts < $2 AND next_attempt_at <= NOW())
          OR (
            status = 'processing'
            AND attempts < $2
            AND updated_at < NOW() - INTERVAL '15 minutes'
          )
       ORDER BY id FOR UPDATE SKIP LOCKED LIMIT $1`,
      [limit, MAX_ATTEMPTS]
    );
    if (rows.length) {
      await client.query(
        `UPDATE email_outbox
         SET status = 'processing', attempts = attempts + 1, updated_at = NOW()
         WHERE id = ANY($1::bigint[])`,
        [rows.map((row) => row.id)]
      );
    }
    await client.query('COMMIT');
    return rows.map((row) => ({ ...row, attempts: row.attempts + 1 }));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const canApplyDeliveryEvent = (current, incoming, occurredAt) => {
  if (!current) return false;
  if (current.status === 'complained' || current.status === 'dead') return false;
  if (incoming.status === 'delivered' && ['bounced', 'complained'].includes(current.status)) return false;
  if (incoming.status === 'bounced' && current.status === 'complained') return false;

  const currentTime = current.provider_event_at
    ? new Date(current.provider_event_at).getTime()
    : null;
  const incomingTime = occurredAt.getTime();
  if (currentTime !== null && incomingTime < currentTime) return false;
  if (currentTime === incomingTime) {
    const currentPriority = Object.values(DELIVERY_EVENTS)
      .find((event) => event.status === current.status)?.priority || 0;
    return incoming.priority > currentPriority;
  }
  return true;
};

const applyDeliveryEvent = async (queryable, providerMessageId, eventType, providerEventAt) => {
  const event = DELIVERY_EVENTS[eventType];
  if (!event) return { applied: false, unsupported: true };
  const occurredAt = new Date(providerEventAt);
  if (Number.isNaN(occurredAt.getTime())) throw new Error('Invalid provider event timestamp');

  const { rows } = await queryable.query(
    `SELECT id, status, provider_event_at
     FROM email_outbox
     WHERE provider_message_id = $1
     FOR UPDATE`,
    [providerMessageId]
  );
  const current = rows[0];
  if (!canApplyDeliveryEvent(current, event, occurredAt)) {
    return { applied: false, missing: !current };
  }

  await queryable.query(
    `UPDATE email_outbox
     SET status = $1,
         provider_event_at = $2,
         ${event.timestampColumn} = $2,
         updated_at = NOW()
     WHERE id = $3`,
    [event.status, occurredAt, current.id]
  );
  return { applied: true, status: event.status };
};

const markAccepted = async (id, providerMessageId) => {
  if (!providerMessageId) throw new Error('Resend did not return a provider message ID');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE email_outbox
       SET status = 'accepted', provider_message_id = $2,
           accepted_at = NOW(), sent_at = NOW(), updated_at = NOW(), last_error = NULL
       WHERE id = $1`,
      [id, providerMessageId]
    );
    const events = await client.query(
      `SELECT event_type, provider_event_at
       FROM email_webhook_events
       WHERE provider_message_id = $1
       ORDER BY provider_event_at, received_at, event_id`,
      [providerMessageId]
    );
    for (const event of events.rows) {
      await applyDeliveryEvent(
        client,
        providerMessageId,
        event.event_type,
        event.provider_event_at
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const markFailed = (id, result, attempts) => {
  const retryable = result.retryable !== false && attempts < MAX_ATTEMPTS;
  const fallbackDelayMs = Math.min(
    MAX_RETRY_DELAY_MS,
    (2 ** Math.max(0, attempts - 1)) * 60 * 1000
  );
  const retryDelayMs = Math.min(
    MAX_RETRY_DELAY_MS,
    Math.max(0, Number(result.retryAfterMs) || fallbackDelayMs)
  );
  return pool.query(
    `UPDATE email_outbox
     SET status = $2,
         last_error = $3,
         next_attempt_at = NOW() + ($4 * INTERVAL '1 millisecond'),
         updated_at = NOW()
     WHERE id = $1`,
    [
      id,
      retryable ? 'failed' : 'dead',
      String(result.error || 'Email delivery failed').slice(0, 1000),
      retryDelayMs,
    ]
  );
};

const purgeExpiredEmailData = async () => {
  const outbox = await pool.query(
    `UPDATE email_outbox
     SET recipient = NULL, subject = NULL, html_body = NULL, text_body = NULL,
         last_error = NULL, payload_purged_at = NOW(), updated_at = NOW()
     WHERE payload_purged_at IS NULL
       AND status IN ('sent', 'accepted', 'delivered', 'dead', 'bounced', 'complained')
       AND updated_at < NOW() - ($1 * INTERVAL '1 day')`,
    [PAYLOAD_RETENTION_DAYS]
  );
  const webhooks = await pool.query(
    `DELETE FROM email_webhook_events
     WHERE received_at < NOW() - ($1 * INTERVAL '1 day')`,
    [PAYLOAD_RETENTION_DAYS]
  );
  return { outboxRows: outbox.rowCount, webhookRows: webhooks.rowCount };
};

module.exports = {
  DELIVERY_EVENTS,
  MAX_ATTEMPTS,
  applyDeliveryEvent,
  claimEmails,
  enqueueEmail,
  markAccepted,
  markFailed,
  purgeExpiredEmailData,
};
