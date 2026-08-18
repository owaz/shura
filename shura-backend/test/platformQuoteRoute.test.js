const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../db');
const router = require('../routes/platform');

const originalQuery = pool.query;
const RealDate = Date;
test.afterEach(() => {
  pool.query = originalQuery;
  global.Date = RealDate;
});

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

test('daily quote cache is capped at the current UTC day boundary', async () => {
  class MockDate extends RealDate {
    constructor(...args) {
      super(...(args.length ? args : ['2026-08-18T23:59:59.500Z']));
    }
    static now() {
      return new RealDate('2026-08-18T23:59:59.500Z').getTime();
    }
  }
  global.Date = MockDate;
  pool.query = async () => ({ rows: [] });

  const res = response();
  await quoteHandler()({}, res);

  assert.equal(res.headers['Cache-Control'], 'public, max-age=1');
});
