const createClientNotification = async (queryable, {
  clientId,
  type,
  title,
  body = '',
  metadata = {},
  dedupeKey = null,
}) => {
  const { rows } = await queryable.query(
    `INSERT INTO notifications (client_id, type, title, body, metadata, dedupe_key)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)
     ON CONFLICT (client_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
     RETURNING id`,
    [clientId, type, title, body, JSON.stringify(metadata || {}), dedupeKey]
  );
  return rows[0] || null;
};

module.exports = { createClientNotification };
