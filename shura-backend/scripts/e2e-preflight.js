const fs = require('fs/promises');
const path = require('path');
const { execFileSync } = require('child_process');
const { Pool } = require('pg');
const {
  backendEnvPath,
  backendRoot,
  databaseConfig,
  frontendEnvPath,
  loadEnvFile,
  normalizeDomain,
  repositoryRoot,
  validateConfiguration,
} = require('./e2eConfig');

const ok = (message) => console.log(`[ok] ${message}`);
const warn = (message) => console.warn(`[warning] ${message}`);
const fail = (message) => console.error(`[error] ${message}`);

function isIgnored(relativePath) {
  try {
    execFileSync('git', ['check-ignore', '-q', relativePath], {
      cwd: repositoryRoot,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

async function checkAuth0(domain) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`https://${normalizeDomain(domain)}/.well-known/openid-configuration`, {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('discovery_unavailable');
    const discovery = await response.json();
    if (!discovery.issuer || !discovery.jwks_uri) throw new Error('discovery_incomplete');
    ok('Auth0 OpenID discovery is reachable for the configured tenant.');
  } finally {
    clearTimeout(timeout);
  }
}

async function migrationFiles() {
  const entries = await fs.readdir(path.join(backendRoot, 'migrations'));
  return entries.filter((entry) => /^\d+.*\.sql$/i.test(entry)).sort();
}

async function checkDatabase(env) {
  const pool = new Pool(databaseConfig(env));
  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      ok('Development database is reachable.');

      const baseResult = await client.query(`SELECT to_regclass('public.users') AS users_table`);
      const files = await migrationFiles();
      if (!baseResult.rows[0].users_table) {
        warn('Base schema is not initialized; run npm run e2e:bootstrap before migrations.');
        warn(`${files.length} migration(s) will be pending after bootstrap.`);
        return;
      }

      const tableResult = await client.query(`SELECT to_regclass('public.schema_migrations') AS migrations_table`);
      let applied = new Set();
      if (tableResult.rows[0].migrations_table) {
        const result = await client.query('SELECT id FROM schema_migrations');
        applied = new Set(result.rows.map((row) => row.id));
      }
      const pending = files.filter((file) => !applied.has(file));
      if (pending.length) {
        warn(`${pending.length} migration(s) pending: ${pending.join(', ')}`);
      } else {
        ok(`All ${files.length} migrations are applied.`);
      }
    } finally {
      client.release();
    }
  } catch (error) {
    const code = error && error.code ? ` (${error.code})` : '';
    throw new Error(`Database connectivity or migration inspection failed${code}.`);
  } finally {
    await pool.end().catch(() => {});
  }
}

async function run() {
  const backend = loadEnvFile(backendEnvPath);
  const frontend = loadEnvFile(frontendEnvPath);
  const { errors, warnings } = validateConfiguration(backend, frontend);

  if (!isIgnored('shura-backend/.env')) errors.push('shura-backend/.env is not ignored by Git.');
  else ok('Backend environment file is ignored by Git.');
  if (!isIgnored('shura-frontend/.env.local')) errors.push('shura-frontend/.env.local is not ignored by Git.');
  else ok('Frontend environment file is ignored by Git.');

  warnings.forEach(warn);
  if (errors.length) {
    errors.forEach(fail);
    process.exitCode = 1;
    return;
  }
  ok('Local environment values pass structural and cross-file validation.');

  try {
    await checkDatabase(backend);
  } catch (error) {
    fail(error.message);
    process.exitCode = 1;
  }
  try {
    await checkAuth0(backend.AUTH0_DOMAIN);
  } catch {
    fail('Auth0 OpenID discovery could not be reached for the configured tenant.');
    process.exitCode = 1;
  }

  if (!process.exitCode) ok('E2E preflight completed successfully without printing secret values.');
}

run();
