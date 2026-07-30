const { createRemoteJWKSet, jwtVerify } = require('jose');
const pool = require('../db');
const { getAuth0Config, getClaim } = require('../config/auth0');

const roleValues = new Set(['client', 'therapist', 'admin']);
let jwks;
let auth0Config;

const getBearerToken = (req) => {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
};

const getJwks = () => {
  if (!jwks) {
    auth0Config = getAuth0Config();
    jwks = createRemoteJWKSet(new URL(`${auth0Config.issuerBaseUrl}.well-known/jwks.json`));
  }
  return jwks;
};

const resolveRoleAndStatus = (payload) => {
  const config = auth0Config || getAuth0Config();
  // Default to 'client' when no role claim is present (e.g. Post-Login Action not yet deployed)
  const role = String(getClaim(payload, config, 'role') || 'client').toLowerCase();
  const status = String(getClaim(payload, config, 'status') || 'active').toLowerCase();
  return { role, status };
};

const defaultDisplayName = (payload) => {
  const fromName = String(payload?.name || '').trim();
  if (fromName) return fromName;
  const fromGiven = String(payload?.given_name || '').trim();
  if (fromGiven) return fromGiven;
  const fromEmail = String(payload?.email || '').trim();
  return fromEmail ? fromEmail.split('@')[0] : 'Shura User';
};

const ensureLocalIdentity = async ({ sub, email, role, status, payload }) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error('Authenticated token is missing email');
  }

  if (role === 'client') {
    const { rows } = await pool.query(
      `SELECT id, email, full_name, status, auth0_sub
       FROM users
       WHERE auth0_sub = $1 OR LOWER(email) = $2
       ORDER BY id ASC
       LIMIT 1`,
      [sub, normalizedEmail]
    );
    if (rows.length) {
      const existing = rows[0];
      await pool.query(
        `UPDATE users
         SET auth0_sub = COALESCE(auth0_sub, $1),
             status = COALESCE($2, status),
             full_name = COALESCE(NULLIF(full_name, ''), $3),
             updated_at = NOW()
         WHERE id = $4`,
        [sub, status || 'active', defaultDisplayName(payload), existing.id]
      );
      return { id: existing.id, email: existing.email, role: 'client', status: status || existing.status || 'active', sub };
    }

    const inserted = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, auth0_sub, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email`,
      [normalizedEmail, 'auth0_managed_identity', defaultDisplayName(payload), sub, status || 'active']
    );
    return { id: inserted.rows[0].id, email: inserted.rows[0].email, role: 'client', status: status || 'active', sub };
  }

  if (role === 'therapist') {
    const { rows } = await pool.query(
      `SELECT id, email, full_name, status, auth0_sub
       FROM therapists
       WHERE auth0_sub = $1 OR LOWER(email) = $2
       ORDER BY id ASC
       LIMIT 1`,
      [sub, normalizedEmail]
    );
    if (rows.length) {
      const existing = rows[0];
      await pool.query(
        `UPDATE therapists
         SET auth0_sub = COALESCE(auth0_sub, $1),
             status = COALESCE($2, status),
             full_name = COALESCE(NULLIF(full_name, ''), $3),
             updated_at = NOW()
         WHERE id = $4`,
        [sub, status || 'pending', defaultDisplayName(payload), existing.id]
      );
      return { id: existing.id, email: existing.email, role: 'therapist', status: status || existing.status || 'pending', sub };
    }

    const inserted = await pool.query(
      `INSERT INTO therapists (email, password_hash, full_name, status, auth0_sub)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email`,
      [normalizedEmail, 'auth0_managed_identity', defaultDisplayName(payload), status || 'pending', sub]
    );
    return { id: inserted.rows[0].id, email: inserted.rows[0].email, role: 'therapist', status: status || 'pending', sub };
  }

  const { rows } = await pool.query(
    `SELECT id, email, full_name, role, auth0_sub
     FROM admins
     WHERE auth0_sub = $1 OR LOWER(email) = $2
     ORDER BY id ASC
     LIMIT 1`,
    [sub, normalizedEmail]
  );
  if (rows.length) {
    const existing = rows[0];
    await pool.query(
      `UPDATE admins
       SET auth0_sub = COALESCE(auth0_sub, $1),
           full_name = COALESCE(NULLIF(full_name, ''), $2),
           updated_at = NOW()
       WHERE id = $3`,
      [sub, defaultDisplayName(payload), existing.id]
    );
    return { id: existing.id, email: existing.email, role: 'admin', status: 'active', sub };
  }

  const inserted = await pool.query(
    `INSERT INTO admins (email, password_hash, full_name, role, auth0_sub)
     VALUES ($1, $2, $3, 'admin', $4)
     RETURNING id, email`,
    [normalizedEmail, 'auth0_managed_identity', defaultDisplayName(payload), sub]
  );
  return { id: inserted.rows[0].id, email: inserted.rows[0].email, role: 'admin', status: 'active', sub };
};

const verifyAccessToken = async (token) => {
  if (!token) throw new Error('Access token required');
  const config = getAuth0Config();
  auth0Config = config;
  const { payload } = await jwtVerify(token, getJwks(), {
    issuer: config.issuer,
    audience: config.audience,
  });
  const { role, status } = resolveRoleAndStatus(payload);
  const validRole = roleValues.has(role) ? role : 'client';
  const sub = String(payload.sub || '').trim();
  if (!sub) {
    throw new Error('Token missing subject claim');
  }
  const email = String(payload.email || '').trim();
  const localIdentity = await ensureLocalIdentity({ sub, email, role: validRole, status, payload });
  return {
    ...payload,
    ...localIdentity,
  };
};

const authenticateToken = async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Bearer access token required' });
    }
    req.user = await verifyAccessToken(token);
    req.authSource = 'bearer';
    return next();
  } catch (err) {
    console.error('[auth] token verification failed:', err?.message || err);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

const requireAdmin = async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: 'Admin access token required' });
    const user = await verifyAccessToken(token);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin privileges required' });
    }
    req.user = user;
    req.admin = user;
    return next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired admin token' });
  }
};

module.exports = { authenticateToken, requireAdmin, verifyAccessToken };
