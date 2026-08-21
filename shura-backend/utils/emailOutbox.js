const pool = require('../db');

const MAX_ATTEMPTS = 5;

const enqueueEmail = async (email) => {
  const { eventKey, emailType, recipient, sender, subject, html, text } = email;
  if (!eventKey || !emailType || !recipient || !sender || !subject || !html) {
    throw new Error('Missing required email outbox fields');
  }
  const { rows } = await pool.query(
    `INSERT INTO email_outbox
      (event_key, email_type, recipient, sender, subject, html_body, text_body)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (event_key) DO NOTHING
     RETURNING id`,
    [eventKey, emailType, recipient, sender, subject, html, text || null]
  );
  return { success: true, queued: true, duplicate: rows.length === 0, id: rows[0]?.id };
};

const claimEmails = async (limit = 20) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT * FROM email_outbox
       WHERE (status = 'pending' AND next_attempt_at <= NOW())
          OR (status = 'failed' AND attempts < $2 AND next_attempt_at <= NOW())
          OR (status = 'processing' AND updated_at < NOW() - INTERVAL '15 minutes')
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

const markSent = (id, providerMessageId) => pool.query(
  `UPDATE email_outbox
   SET status = 'sent', provider_message_id = $2, sent_at = NOW(), updated_at = NOW(), last_error = NULL
   WHERE id = $1`,
  [id, providerMessageId || null]
);

const markFailed = (id, error, attempts) => {
  const delayMinutes = Math.min(60, 2 ** Math.max(0, attempts - 1));
  return pool.query(
    `UPDATE email_outbox
     SET status = 'failed',
         last_error = $2, next_attempt_at = NOW() + ($3 * INTERVAL '1 minute'), updated_at = NOW()
     WHERE id = $1`,
    [id, String(error).slice(0, 1000), delayMinutes]
  );
};

module.exports = { enqueueEmail, claimEmails, markSent, markFailed };
