const jwt = require('jsonwebtoken');
const pool = require('../db');
const { ACCESS_COOKIE, CSRF_COOKIE, getJwtSecret, parseCookies } = require('../utils/sessionAuth');

const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const getBearerToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ');
  return scheme?.toLowerCase() === 'bearer' ? token : null;
};

/**
 * Middleware to authenticate JWT token from secure cookie or legacy Bearer token.
 */
const authenticateToken = async (req, res, next) => {
  const cookies = parseCookies(req.headers.cookie || '');
  const bearerToken = getBearerToken(req);
  const token = bearerToken || cookies[ACCESS_COOKIE];
  const usedCookieAuth = Boolean(!bearerToken && cookies[ACCESS_COOKIE]);

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const user = jwt.verify(token, getJwtSecret());

    if (usedCookieAuth && unsafeMethods.has(req.method)) {
      const csrfHeader = req.headers['x-csrf-token'];
      if (!csrfHeader || csrfHeader !== cookies[CSRF_COOKIE]) {
        return res.status(403).json({ error: 'Invalid CSRF token' });
      }
    }

    if (user.sid) {
      const { rows } = await pool.query(
        'SELECT id FROM auth_sessions WHERE id = $1 AND revoked_at IS NULL AND expires_at > NOW()',
        [user.sid]
      );
      if (!rows.length) {
        return res.status(401).json({ error: 'Session expired or revoked' });
      }
    }

    req.user = user;
    req.authSource = bearerToken ? 'bearer' : 'cookie';
    next();
  } catch (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Strict admin-only guard: requires a Bearer token signed with the same JWT secret
// and a payload that identifies an admin (role === 'admin' or type === 'admin').
const requireAdmin = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Admin access token required' });
  }

  jwt.verify(token, getJwtSecret(), (err, payload) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired admin token' });
    }

    const isAdmin = payload?.role === 'admin' || payload?.type === 'admin';
    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin privileges required' });
    }

    req.admin = payload;
    next();
  });
};

module.exports = { authenticateToken, requireAdmin };
