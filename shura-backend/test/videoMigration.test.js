const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { Client } = require('pg');

const backendRoot = path.join(__dirname, '..');
const migrationsDir = path.join(backendRoot, 'migrations');
const databaseUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const databaseIsSafe = process.env.E2E_DATABASE_SAFE_TO_MUTATE === 'true';
const skip = !databaseUrl || !databaseIsSafe
  ? 'Set MIGRATION_TEST_DATABASE_URL and E2E_DATABASE_SAFE_TO_MUTATE=true for disposable PostgreSQL tests.'
  : false;

const readSql = (filePath) => fs.readFile(filePath, 'utf8');

async function applySql(client, sql) {
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function withDisposableDatabase(prefix, callback) {
  const admin = new Client({ connectionString: databaseUrl });
  const databaseName = `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`;
  const isolatedUrl = new URL(databaseUrl);
  isolatedUrl.pathname = `/${databaseName}`;
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    const client = new Client({ connectionString: isolatedUrl.toString() });
    await client.connect();
    try {
      await callback(client, 'public');
    } finally {
      await client.end();
    }
  } finally {
    await admin.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await admin.end();
  }
}

async function applyMigrationsUpTo(client, maxMigrationNumber) {
  const files = (await fs.readdir(migrationsDir))
    .filter((entry) => /^\d+.*\.sql$/i.test(entry))
    .sort()
    .filter((file) => Number.parseInt(file.slice(0, 3), 10) <= maxMigrationNumber);
  for (const file of files) {
    await applySql(client, await readSql(path.join(migrationsDir, file)));
  }
}

async function assertVideoFoundationSchema(client, schema) {
  const tables = await client.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = $1
       AND table_name IN ('video_sessions', 'video_participants', 'video_webhook_events')
     ORDER BY table_name`,
    [schema]
  );
  assert.deepEqual(
    tables.rows.map((row) => row.table_name),
    ['video_participants', 'video_sessions', 'video_webhook_events']
  );

  const videoSessionConstraint = await client.query(
    `SELECT pg_get_constraintdef(c.oid) AS definition
     FROM pg_constraint c
     JOIN pg_class t ON t.oid = c.conrelid
     JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = $1
       AND t.relname = 'video_sessions'
       AND c.conname = 'video_sessions_status_check'`,
    [schema]
  );
  assert.equal(videoSessionConstraint.rowCount, 1);
  for (const status of [
    'scheduled',
    'provisioning',
    'ready',
    'live',
    'rejoinable',
    'ended',
    'cancelled',
    'expired',
    'failed',
  ]) {
    assert.match(videoSessionConstraint.rows[0].definition, new RegExp(`'${status}'`));
  }

  const webhookConstraint = await client.query(
    `SELECT pg_get_constraintdef(c.oid) AS definition
     FROM pg_constraint c
     JOIN pg_class t ON t.oid = c.conrelid
     JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = $1
       AND t.relname = 'video_webhook_events'
       AND c.conname = 'video_webhook_events_processing_status_check'`,
    [schema]
  );
  assert.equal(webhookConstraint.rowCount, 1);
  for (const status of ['pending', 'processing', 'processed', 'failed']) {
    assert.match(webhookConstraint.rows[0].definition, new RegExp(`'${status}'`));
  }

  const indexes = await client.query(
    `SELECT indexname
     FROM pg_indexes
     WHERE schemaname = $1
       AND indexname IN (
         'idx_video_sessions_status',
         'idx_video_sessions_updated_at',
         'idx_video_participants_session_role',
         'idx_video_webhook_events_participant_dedupe',
         'idx_video_webhook_events_processing',
         'idx_video_webhook_events_room_event_time'
       )
     ORDER BY indexname`,
    [schema]
  );
  assert.equal(indexes.rowCount, 6);

  const bookingStatusConstraint = await client.query(
    `SELECT pg_get_constraintdef(c.oid) AS definition
     FROM pg_constraint c
     JOIN pg_class t ON t.oid = c.conrelid
     JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = $1
       AND t.relname = 'bookings'
       AND c.conname = 'bookings_status_check'`,
    [schema]
  );
  assert.equal(bookingStatusConstraint.rowCount, 1);
  assert.match(bookingStatusConstraint.rows[0].definition, /'no-show'/);
  assert.match(bookingStatusConstraint.rows[0].definition, /'no_show_client'/);
  assert.match(bookingStatusConstraint.rows[0].definition, /'no_show_therapist'/);
}

test('migration 019 upgrades existing bookings state and preserves legacy rows', { skip }, async () => {
  await withDisposableDatabase('video_upgrade', async (client, schema) => {
    await applySql(client, await readSql(path.join(backendRoot, 'production_schema.sql')));
    await applyMigrationsUpTo(client, 18);

    const user = await client.query(
      `INSERT INTO users (email, password_hash, full_name)
       VALUES ('migration.video.client@example.test', 'hash', 'Video Client')
       RETURNING id`
    );
    const therapist = await client.query(
      `INSERT INTO therapists (email, password_hash, full_name)
       VALUES ('migration.video.therapist@example.test', 'hash', 'Video Therapist')
       RETURNING id`
    );

    const userId = user.rows[0].id;
    const therapistId = therapist.rows[0].id;
    await client.query(
      `INSERT INTO bookings (user_id, therapist_id, date, time, session_type, status, payment_status, scheduled_at, duration_minutes)
       VALUES
         ($1, $2, CURRENT_DATE + INTERVAL '1 day', '10:00', 'video', 'confirmed', 'completed', NOW() + INTERVAL '1 day', 50),
         ($1, $2, CURRENT_DATE + INTERVAL '2 day', '11:00', 'video', 'no-show', 'pending', NOW() + INTERVAL '2 day', 50)`,
      [userId, therapistId]
    );

    await applySql(client, await readSql(path.join(migrationsDir, '019_video_calling_foundation.sql')));
    await assertVideoFoundationSchema(client, schema);

    const statuses = await client.query('SELECT status FROM bookings ORDER BY id');
    assert.deepEqual(statuses.rows.map((row) => row.status), ['confirmed', 'no-show']);

    await client.query(`UPDATE bookings SET status = 'no_show_client' WHERE status = 'no-show'`);
    await client.query(`UPDATE bookings SET status = 'no_show_therapist' WHERE status = 'confirmed'`);

    const updated = await client.query('SELECT status FROM bookings ORDER BY id');
    assert.deepEqual(updated.rows.map((row) => row.status), ['no_show_therapist', 'no_show_client']);
  });
});

test('fresh bootstrap through all migrations includes video foundation tables and constraints', { skip }, async () => {
  await withDisposableDatabase('video_fresh', async (client, schema) => {
    await applySql(client, await readSql(path.join(backendRoot, 'production_schema.sql')));
    await applyMigrationsUpTo(client, 19);
    await assertVideoFoundationSchema(client, schema);
  });
});
