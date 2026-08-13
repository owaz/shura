const fs = require('fs/promises');
const path = require('path');
const { Pool } = require('pg');
const {
  backendEnvPath,
  backendRoot,
  databaseConfig,
  loadEnvFile,
  mutationSafetyErrors,
} = require('./e2eConfig');

async function run() {
  const env = loadEnvFile(backendEnvPath);
  const safetyErrors = mutationSafetyErrors(env);
  if (safetyErrors.length) {
    safetyErrors.forEach((message) => console.error(`[error] ${message}`));
    process.exitCode = 1;
    return;
  }

  const sql = await fs.readFile(path.join(backendRoot, 'production_schema.sql'), 'utf8');
  const pool = new Pool(databaseConfig(env));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('[ok] Development base schema is initialized. Run npm run migrate next.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    const code = error && error.code ? ` (${error.code})` : '';
    console.error(`[error] Base schema initialization failed${code}.`);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(() => {
  console.error('[error] Base schema initialization failed.');
  process.exit(1);
});
