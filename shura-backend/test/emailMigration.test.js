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

async function withDisposableSchema(prefix, callback) {
  const client = new Client({ connectionString: databaseUrl });
  const schema = `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`;
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    await callback(client, schema);
  } finally {
    await client.query('SET search_path TO public');
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.end();
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

async function applyAllMigrations(client) {
  await applySql(client, await readSql(path.join(backendRoot, 'production_schema.sql')));
  const files = (await fs.readdir(migrationsDir))
    .filter((entry) => /^\d+.*\.sql$/i.test(entry))
    .sort();
  for (const file of files) {
    await applySql(client, await readSql(path.join(migrationsDir, file)));
  }
}

async function assertHardenedSchema(client, schema) {
  const columns = await client.query(
    `SELECT table_name, column_name, is_nullable
     FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name IN ('email_outbox', 'email_webhook_events')`,
    [schema]
  );
  const byName = new Map(columns.rows.map((column) => [
    `${column.table_name}.${column.column_name}`,
    column,
  ]));

  for (const column of [
    'accepted_at',
    'delivered_at',
    'bounced_at',
    'complained_at',
    'provider_event_at',
    'payload_purged_at',
  ]) {
    assert.ok(byName.has(`email_outbox.${column}`), `email_outbox.${column} should exist`);
  }
  for (const column of ['provider_message_id', 'provider_event_at']) {
    assert.ok(byName.has(`email_webhook_events.${column}`), `email_webhook_events.${column} should exist`);
  }
  for (const column of ['recipient', 'subject', 'html_body']) {
    assert.equal(byName.get(`email_outbox.${column}`)?.is_nullable, 'YES');
  }

  const constraint = await client.query(
    `SELECT pg_get_constraintdef(c.oid) AS definition
     FROM pg_constraint c
     JOIN pg_class t ON t.oid = c.conrelid
     JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = $1
       AND t.relname = 'email_outbox'
       AND c.conname = 'email_outbox_status_check'`,
    [schema]
  );
  assert.equal(constraint.rowCount, 1);
  for (const status of [
    'pending',
    'processing',
    'sent',
    'accepted',
    'delivered',
    'failed',
    'dead',
    'bounced',
    'complained',
  ]) {
    assert.match(constraint.rows[0].definition, new RegExp(`'${status}'`));
  }

  const indexes = await client.query(
    `SELECT indexname, indexdef
     FROM pg_indexes
     WHERE schemaname = $1
       AND indexname IN (
         'idx_email_outbox_provider_message_id',
         'idx_email_outbox_terminal_retention',
         'idx_email_webhook_events_provider_message',
         'idx_email_webhook_events_retention'
       )`,
    [schema]
  );
  assert.equal(indexes.rowCount, 4);
  const retention = indexes.rows.find((index) =>
    index.indexname === 'idx_email_outbox_terminal_retention'
  );
  assert.match(retention.indexdef, /'sent'/);
}

async function assertAcceptedRetentionIndex(client, schema) {
  const index = await client.query(
    `SELECT indexdef
     FROM pg_indexes
     WHERE schemaname = $1
       AND indexname = 'idx_email_outbox_payload_retention'`,
    [schema]
  );
  assert.equal(index.rowCount, 1);
  assert.match(index.rows[0].indexdef, /'accepted'/);
}

test('migration 017 upgrades migration 016 state in PostgreSQL', { skip }, async () => {
  await withDisposableSchema('email_upgrade', async (client, schema) => {
    await applySql(client, await readSql(path.join(migrationsDir, '016_email_outbox.sql')));
    for (const status of ['pending', 'processing', 'sent', 'failed', 'bounced', 'complained']) {
      await client.query(
        `INSERT INTO email_outbox
          (event_key, email_type, recipient, sender, subject, html_body, status)
         VALUES ($1, 'test', 'recipient@example.test', 'sender@example.test', 'Subject', '<p>Body</p>', $2)`,
        [`event-${status}`, status]
      );
    }

    await applySql(client, await readSql(path.join(migrationsDir, '017_email_delivery_hardening.sql')));
    await assertHardenedSchema(client, schema);

    const preserved = await client.query('SELECT status FROM email_outbox ORDER BY status');
    assert.deepEqual(
      preserved.rows.map((row) => row.status),
      ['bounced', 'complained', 'failed', 'pending', 'processing', 'sent']
    );
  });
});

test('fresh bootstrap through all migrations produces the hardened schema', { skip }, async () => {
  await withDisposableDatabase('email_fresh', async (client, schema) => {
    await applyAllMigrations(client);
    await assertHardenedSchema(client, schema);
    await assertAcceptedRetentionIndex(client, schema);
  });
});

test('migration 018 indexes accepted messages for payload retention', { skip }, async () => {
  await withDisposableSchema('email_retention', async (client, schema) => {
    await applySql(client, await readSql(path.join(migrationsDir, '016_email_outbox.sql')));
    await applySql(client, await readSql(path.join(migrationsDir, '017_email_delivery_hardening.sql')));
    await applySql(client, await readSql(path.join(migrationsDir, '018_include_accepted_email_retention.sql')));
    await assertAcceptedRetentionIndex(client, schema);
  });
});
