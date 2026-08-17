const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../db');
const router = require('../routes/platform');

const originalQuery = pool.query;
test.afterEach(() => { pool.query = originalQuery; });

const quoteHandler = () => {
  const layer = router.stack.find((item) => item.route?.path === '/quote-of-the-day' && item.route.methods.get);
  if (!layer) throw new Error('Missing GET /quote-of-the-day');
  return layer.route.stack.at(-1).handle;
};

const response = () => ({
  headers: {},
  body: null,
  set(name, value) { this.headers[name] = value; return this; },
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.body = payload; return this; },
});

test('daily quote query only selects active human-approved rows', async () => {
  let call;
  pool.query = async (sql, params) => {
    call = { sql, params };
    return { rows: [] };
  };
  const res = response();
  await quoteHandler()({}, res);

  assert.match(call.sql, /is_active = TRUE AND editorial_status = 'approved'/);
  assert.equal(Number.isInteger(call.params[0]), true);
  assert.equal(res.body.data.dateBoundary, 'UTC');
  assert.equal(res.body.data.quote, null);
  assert.equal(res.body.data.editorialReviewRequired, true);
});
