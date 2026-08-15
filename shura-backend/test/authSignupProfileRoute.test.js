const test = require('node:test');
const assert = require('node:assert/strict');

const pool = require('../db');
const authRouter = require('../routes/auth');

const signupProfileRouteLayer = authRouter.stack.find((layer) =>
  layer.route
  && layer.route.path === '/signup-profile'
  && layer.route.methods.post
);

if (!signupProfileRouteLayer) {
  throw new Error('Expected POST /signup-profile route to be registered.');
}

const authMiddleware = signupProfileRouteLayer.route.stack[0].handle;
const signupProfileHandler = signupProfileRouteLayer.route.stack[1].handle;

const originalQuery = pool.query;

test.after(() => {
  pool.query = originalQuery;
});

const createResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
});

test('signup profile route rejects unauthenticated requests', async () => {
  const req = { headers: {} };
  const res = createResponse();
  let nextCalled = false;

  await authMiddleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body?.error?.code, 'AUTHENTICATION_REQUIRED');
});

test('signup profile route rejects non-client roles', async () => {
  let queryCount = 0;
  pool.query = async () => {
    queryCount += 1;
    throw new Error('Query should not be called for non-client role');
  };

  const req = {
    user: { id: 123, role: 'therapist' },
    body: { fullName: 'Therapist Name' },
  };
  const res = createResponse();

  await signupProfileHandler(req, res);

  assert.equal(res.statusCode, 403);
  assert.equal(res.body?.error?.code, 'CLIENT_ROLE_REQUIRED');
  assert.equal(queryCount, 0);
});

test('signup profile route rejects invalid full names', async () => {
  let queryCount = 0;
  pool.query = async () => {
    queryCount += 1;
    throw new Error('Query should not be called for invalid full name');
  };

  const req = {
    user: { id: 321, role: 'client' },
    body: { fullName: 'A' },
  };
  const res = createResponse();

  await signupProfileHandler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body?.error?.code, 'INVALID_SIGNUP_NAME');
  assert.equal(queryCount, 0);
});

test('signup profile route does not overwrite established names', async () => {
  const calls = [];
  pool.query = async (sql, params) => {
    calls.push({ sql, params });
    return {
      rows: [{ id: 5, email: 'client@example.com', full_name: 'Amina Rahman' }],
    };
  };

  const req = {
    user: { id: 5, role: 'client' },
    body: { fullName: 'Layla Noor' },
  };
  const res = createResponse();

  await signupProfileHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { data: { applied: false, fullName: 'Amina Rahman' } });
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /SELECT id, email, full_name FROM users WHERE id = \$1/);
});

test('signup profile route preserves concurrent profile updates', async () => {
  const calls = [];
  pool.query = async (sql, params) => {
    calls.push({ sql, params });

    if (calls.length === 1) {
      return {
        rows: [{ id: 9, email: 'client@example.com', full_name: 'Shura' }],
      };
    }

    if (calls.length === 2) {
      return { rows: [] };
    }

    if (calls.length === 3) {
      return {
        rows: [{ full_name: 'Layla Noor' }],
      };
    }

    throw new Error('Unexpected query call');
  };

  const req = {
    user: { id: 9, role: 'client' },
    body: { fullName: 'Fatima Zahra' },
  };
  const res = createResponse();

  await signupProfileHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { data: { applied: false, fullName: 'Layla Noor' } });
  assert.equal(calls.length, 3);
  assert.match(calls[1].sql, /IS NOT DISTINCT FROM/);
});
