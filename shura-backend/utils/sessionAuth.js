const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const ACCESS_COOKIE = 'shura_access_token';
const REFRESH_COOKIE = 'shura_refresh_token';
const CSRF_COOKIE = 'shura_csrf_token';

const accessMaxAgeMs = 15 * 60 * 1000;
const refreshMaxAgeMs = 30 * 24 * 60 * 60 * 1000;

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be configured in production');
  }
  return secret || 'shura_dev_jwt_secret_change_me';
};

const parseCookies = (cookieHeader = '') => {
  return cookieHeader.split(';').reduce((cookies, part) => {
    const [rawName, ...rawValue] = part.trim().split('=');
    if (!rawName) return cookies;
    cookies[rawName] = decodeURIComponent(rawValue.join('=') || '');
    return cookies;
  }, {});
};

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const randomToken = () => crypto.randomBytes(32).toString('base64url');

const getCookieSameSite = () => {
  const configured = (process.env.COOKIE_SAME_SITE || '').toLowerCase();
  if (['lax', 'strict', 'none'].includes(configured)) return configured;
  return process.env.NODE_ENV === 'production' ? 'none' : 'lax';
};

const shouldUseSecureCookies = () => process.env.NODE_ENV === 'production' || getCookieSameSite() === 'none';

const cookieOptions = (maxAge, httpOnly = true) => ({
  httpOnly,
  secure: shouldUseSecureCookies(),
  sameSite: getCookieSameSite(),
  path: '/',
  maxAge,
});

const clearAuthCookies = (res) => {
  const base = { path: '/', sameSite: getCookieSameSite(), secure: shouldUseSecureCookies() };
  res.clearCookie(ACCESS_COOKIE, { ...base, httpOnly: true });
  res.clearCookie(REFRESH_COOKIE, { ...base, httpOnly: true });
  res.clearCookie(CSRF_COOKIE, { ...base, httpOnly: false });
};

const issueAccessToken = ({ user, role, sessionId }) => jwt.sign(
  { id: user.id, email: user.email, role, sid: sessionId },
  getJwtSecret(),
  { expiresIn: '15m' }
);

const createSession = async (req, res, user, role) => {
  const sessionId = crypto.randomUUID();
  const refreshToken = randomToken();
  const csrfToken = randomToken();
  const refreshExpiresAt = new Date(Date.now() + refreshMaxAgeMs);

  await pool.query(
    `INSERT INTO auth_sessions
      (id, user_id, role, refresh_token_hash, csrf_token, user_agent, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      sessionId,
      user.id,
      role,
      hashToken(refreshToken),
      csrfToken,
      req.get('user-agent') || null,
      req.ip || null,
      refreshExpiresAt,
    ]
  );

  const accessToken = issueAccessToken({ user, role, sessionId });
  res.cookie(ACCESS_COOKIE, accessToken, cookieOptions(accessMaxAgeMs, true));
  res.cookie(REFRESH_COOKIE, `${sessionId}.${refreshToken}`, cookieOptions(refreshMaxAgeMs, true));
  res.cookie(CSRF_COOKIE, csrfToken, cookieOptions(refreshMaxAgeMs, false));

  return {
    accessToken,
    csrfToken,
    sessionId,
  };
};

const rotateSession = async (req, res) => {
  const cookies = parseCookies(req.headers.cookie || '');
  const refreshCookie = cookies[REFRESH_COOKIE];
  if (!refreshCookie || !refreshCookie.includes('.')) return null;

  const [sessionId, refreshToken] = refreshCookie.split('.', 2);
  const { rows } = await pool.query(
    `SELECT s.*,
            COALESCE(u.email, t.email) as email,
            COALESCE(u.full_name, t.full_name) as full_name
     FROM auth_sessions s
     LEFT JOIN users u ON u.id = s.user_id AND s.role = 'client'
     LEFT JOIN therapists t ON t.id = s.user_id AND s.role = 'therapist'
     WHERE s.id = $1 AND s.revoked_at IS NULL AND s.expires_at > NOW()`,
    [sessionId]
  );
  const session = rows[0];
  if (!session || session.refresh_token_hash !== hashToken(refreshToken)) return null;

  const nextRefreshToken = randomToken();
  const nextCsrfToken = randomToken();
  await pool.query(
    `UPDATE auth_sessions
     SET refresh_token_hash = $1, csrf_token = $2, last_used_at = NOW()
     WHERE id = $3`,
    [hashToken(nextRefreshToken), nextCsrfToken, sessionId]
  );

  const user = { id: session.user_id, email: session.email };
  const accessToken = issueAccessToken({ user, role: session.role, sessionId });
  res.cookie(ACCESS_COOKIE, accessToken, cookieOptions(accessMaxAgeMs, true));
  res.cookie(REFRESH_COOKIE, `${sessionId}.${nextRefreshToken}`, cookieOptions(refreshMaxAgeMs, true));
  res.cookie(CSRF_COOKIE, nextCsrfToken, cookieOptions(refreshMaxAgeMs, false));

  return {
    user: { id: session.user_id, email: session.email, full_name: session.full_name, role: session.role },
    csrfToken: nextCsrfToken,
    accessToken,
    sessionId,
  };
};

const revokeSession = async (sessionId) => {
  if (!sessionId) return;
  await pool.query('UPDATE auth_sessions SET revoked_at = NOW() WHERE id = $1', [sessionId]);
};

module.exports = {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  CSRF_COOKIE,
  clearAuthCookies,
  createSession,
  getJwtSecret,
  parseCookies,
  revokeSession,
  rotateSession,
};
