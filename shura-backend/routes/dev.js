const express = require('express');
const router = express.Router();
const pool = require('../db');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'shura_super_secret_jwt_key_2024';

// Dev-only helper: create or reuse a test user and return an HTML page that
// sets the auth token in localStorage and redirects to the SPA.
router.get('/login', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') return res.status(403).send('Not allowed in production');

    let { email, password, token } = req.query;
    email = email?.toString();
    password = password?.toString();
    token = token?.toString();

    let user;

    if (!token) {
      if (email) {
        // Try to find existing user
        const r = await pool.query('SELECT id, email, full_name FROM users WHERE email = $1', [email]);
        if (r.rows.length) {
          user = r.rows[0];
        } else {
          // create with provided password or default
          const pw = password || 'devpass123';
          const hashed = await argon2.hash(pw);
          const q = 'INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id, email, full_name';
          const inserted = await pool.query(q, [email, hashed, 'Dev User']);
          user = inserted.rows[0];
        }
      } else {
        // No email provided — create a fresh dev user
        const devEmail = `dev+${Date.now()}@example.com`;
        const devPassword = 'devpass123';
        const hashed = await argon2.hash(devPassword);
        const q = 'INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id, email, full_name';
        const inserted = await pool.query(q, [devEmail, hashed, 'Dev User']);
        user = inserted.rows[0];
        password = devPassword;
        email = devEmail;
      }

      token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    }

    // Return an HTML page that sets localStorage and redirects to the dashboard
    const safeUser = { id: user?.id || null, email: user?.email || email || null, full_name: user?.full_name || 'Dev User' };
    const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>
<p>Signing in as <strong>${safeUser.email}</strong> and redirecting to dashboard...</p>
<script>
  try {
    localStorage.setItem('shura-auth-token', '${token}');
    localStorage.setItem('shura-current-user', JSON.stringify(${JSON.stringify(safeUser)}));
  } catch(e) {}
  window.location.href = '/client/dashboard';
</script>
</body></html>`;

    res.set('Content-Type', 'text/html');
    return res.send(html);
  } catch (err) {
    console.error('DEV /login error', err);
    return res.status(500).send('Dev login error: ' + (err.message || err));
  }
});

// Dev-only helper: admin login and redirect to admin dashboard
router.get('/admin-login', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') return res.status(403).send('Not allowed in production');

    let { email, password, token } = req.query;
    email = email?.toString();
    password = password?.toString();
    token = token?.toString();

    let admin;
    const bcrypt = require('bcrypt');

    if (!token) {
      if (email) {
        const r = await pool.query('SELECT id, email, full_name FROM admins WHERE email = $1', [email]);
        if (r.rows.length) {
          admin = r.rows[0];
        } else {
          const pw = password || 'admin123';
          const hashed = await bcrypt.hash(pw, 10);
          const q = 'INSERT INTO admins (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id, email, full_name, role';
          const inserted = await pool.query(q, [email || `admin+${Date.now()}@example.com`, hashed, 'Dev Admin']);
          admin = inserted.rows[0];
        }
      } else {
        // create a fresh dev admin
        const adminEmail = `admin+${Date.now()}@example.com`;
        const adminPassword = 'admin123';
        const hashed = await bcrypt.hash(adminPassword, 10);
        const q = 'INSERT INTO admins (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id, email, full_name, role';
        const inserted = await pool.query(q, [adminEmail, hashed, 'Dev Admin']);
        admin = inserted.rows[0];
        password = adminPassword;
        email = adminEmail;
      }

      token = jwt.sign({ id: admin.id, email: admin.email, role: admin.role, type: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
    }

    const safeAdmin = { id: admin?.id || null, email: admin?.email || email || null, full_name: admin?.full_name || 'Dev Admin', role: admin?.role || 'admin' };
    const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>
<p>Signing in admin as <strong>${safeAdmin.email}</strong> and redirecting to admin dashboard...</p>
<script>
  try {
    localStorage.setItem('adminToken', '${token}');
    localStorage.setItem('adminUser', JSON.stringify(${JSON.stringify(safeAdmin)}));
  } catch(e) {}
  window.location.href = '/admin/dashboard';
</script>
</body></html>`;

    res.set('Content-Type', 'text/html');
    return res.send(html);
  } catch (err) {
    console.error('DEV /admin-login error', err);
    return res.status(500).send('Dev admin login error: ' + (err.message || err));
  }
});

// Dev helper: set both client and admin tokens and redirect to a chosen path
router.get('/quick-login', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') return res.status(403).send('Not allowed in production');

    const { clientEmail, adminEmail, redirect } = req.query;
    // Create or reuse client
    const clientResp = await (async () => {
      let email = clientEmail?.toString();
      if (!email) {
        email = `dev+${Date.now()}@example.com`;
      }
      // reuse existing logic by calling /login route programmatically
      // simple create-if-not-exists
      const r = await pool.query('SELECT id, email, full_name FROM users WHERE email = $1', [email]);
      if (r.rows.length) return r.rows[0];
      const hashed = await argon2.hash('devpass123');
      const q = 'INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id, email, full_name';
      const inserted = await pool.query(q, [email, hashed, 'Dev User']);
      return inserted.rows[0];
    })();

    const clientToken = jwt.sign({ id: clientResp.id, email: clientResp.email }, JWT_SECRET, { expiresIn: '7d' });

    // Create or reuse admin
    const adminResp = await (async () => {
      let email = adminEmail?.toString();
      if (!email) {
        email = `admin+${Date.now()}@example.com`;
      }
      const r = await pool.query('SELECT id, email, full_name, role FROM admins WHERE email = $1', [email]);
      if (r.rows.length) return r.rows[0];
      const hashed = await require('bcrypt').hash('admin123', 10);
      const q = 'INSERT INTO admins (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id, email, full_name, role';
      const inserted = await pool.query(q, [email, hashed, 'Dev Admin']);
      return inserted.rows[0];
    })();

    const adminToken = jwt.sign({ id: adminResp.id, email: adminResp.email, role: adminResp.role, type: 'admin' }, JWT_SECRET, { expiresIn: '7d' });

    const safeClient = { id: clientResp.id, email: clientResp.email, full_name: clientResp.full_name };
    const safeAdmin = { id: adminResp.id, email: adminResp.email, full_name: adminResp.full_name, role: adminResp.role };

    const dest = (redirect && redirect.toString()) || '/';
    const html = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<p>Setting client and admin tokens and redirecting...</p>
<script>
  try {
    localStorage.setItem('shura-auth-token', '${clientToken}');
    localStorage.setItem('shura-current-user', JSON.stringify(${JSON.stringify(safeClient)}));
    localStorage.setItem('adminToken', '${adminToken}');
    localStorage.setItem('adminUser', JSON.stringify(${JSON.stringify(safeAdmin)}));
  } catch(e) {}
  window.location.href = '${dest}';
</script></body></html>`;

    res.set('Content-Type', 'text/html');
    return res.send(html);
  } catch (err) {
    console.error('DEV /quick-login error', err);
    return res.status(500).send('Dev quick-login error: ' + (err.message || err));
  }
});

module.exports = router;
