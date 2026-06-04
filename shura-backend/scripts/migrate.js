require('dotenv').config();
const fs = require('fs/promises');
const path = require('path');
const pool = require('../db');

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

async function appliedMigrations(client) {
  const { rows } = await client.query('SELECT id FROM schema_migrations');
  return new Set(rows.map((row) => row.id));
}

async function migrationFiles() {
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const entries = await fs.readdir(migrationsDir);
  return entries
    .filter((entry) => /^\d+.*\.sql$/i.test(entry))
    .sort()
    .map((entry) => ({ id: entry, filePath: path.join(migrationsDir, entry) }));
}

async function run() {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await appliedMigrations(client);
    const files = await migrationFiles();

    for (const file of files) {
      if (applied.has(file.id)) {
        console.log(`Skipping ${file.id} (already applied)`);
        continue;
      }

      console.log(`Applying ${file.id}`);
      const sql = await fs.readFile(file.filePath, 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [file.id]);
        await client.query('COMMIT');
        console.log(`Applied ${file.id}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    console.log('Database migrations complete');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
