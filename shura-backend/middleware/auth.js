const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'shura_super_secret_jwt_key_2024';

/**
 * Middleware to authenticate JWT token from Authorization header
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Extract token from "Bearer <token>"

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Strict admin-only guard: requires a Bearer token signed with the same JWT secret
// and a payload that identifies an admin (role === 'admin' or type === 'admin').
const requireAdmin = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Admin access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, payload) => {
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
