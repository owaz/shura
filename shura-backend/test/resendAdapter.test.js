const { EventEmitter } = require('events');
const test = require('node:test');
const assert = require('node:assert/strict');
const https = require('https');
const { parseRetryAfter, sendEmail } = require('../utils/resendAdapter');

const originalRequest = https.request;

const email = {
  from: 'sender@example.test',
  to: 'recipient@example.test',
  subject: 'Subject',
  html: '<p>Body</p>',
  text: 'Body',
  idempotencyKey: 'event:1',
};

const mockResponse = ({ statusCode, body, headers = {} }) => {
  let requestOptions;
  let requestBody;
  https.request = (_url, options, callback) => {
    requestOptions = options;
    const req = new EventEmitter();
    req.setTimeout = () => {};
    req.write = (value) => { requestBody = value; };
    req.destroy = (error) => req.emit('error', error);
    req.end = () => {
      const res = new EventEmitter();
      res.statusCode = statusCode;
      res.headers = headers;
      res.destroy = (error) => res.emit('error', error);
      callback(res);
      process.nextTick(() => {
        if (body) res.emit('data', Buffer.from(JSON.stringify(body)));
        res.emit('end');
      });
    };
    return req;
  };
  return {
    request: () => ({ requestOptions, requestBody }),
  };
};

const mockRequestFailure = ({ timeout = false }) => {
  https.request = () => {
    const req = new EventEmitter();
    req.setTimeout = (_milliseconds, callback) => {
      if (timeout) req.timeoutCallback = callback;
    };
    req.write = () => {};
    req.destroy = (error) => process.nextTick(() => req.emit('error', error));
    req.end = () => {
      if (timeout) req.timeoutCallback();
      else process.nextTick(() => req.emit('error', new Error('connection reset')));
    };
    return req;
  };
};

test.beforeEach(() => {
  process.env.RESEND_API_KEY = 'test-key';
});

test.afterEach(() => {
  https.request = originalRequest;
  delete process.env.RESEND_API_KEY;
});

test('sends a Resend request with the stable idempotency key', async () => {
  const mocked = mockResponse({ statusCode: 200, body: { id: 're_123' } });

  const result = await sendEmail(email);
  const request = mocked.request();

  assert.deepEqual(result, { success: true, messageId: 're_123', statusCode: 200 });
  assert.equal(request.requestOptions.headers['Idempotency-Key'], 'event:1');
  assert.equal(
    JSON.parse(request.requestBody).text,
    'Body'
  );
});

test('marks rate limits retryable and honors Retry-After', async () => {
  mockResponse({
    statusCode: 429,
    body: { message: 'rate limited' },
    headers: { 'retry-after': '120' },
  });

  const result = await sendEmail(email);

  assert.equal(result.success, false);
  assert.equal(result.retryable, true);
  assert.equal(result.retryAfterMs, 120000);
  assert.equal(result.statusCode, 429);
});

test('marks permanent provider validation errors non-retryable', async () => {
  mockResponse({
    statusCode: 422,
    body: { message: 'invalid sender' },
  });

  const result = await sendEmail(email);

  assert.equal(result.success, false);
  assert.equal(result.retryable, false);
  assert.equal(result.statusCode, 422);
});

test('marks provider server errors retryable', async () => {
  mockResponse({
    statusCode: 503,
    body: { message: 'temporarily unavailable' },
  });

  const result = await sendEmail(email);

  assert.equal(result.success, false);
  assert.equal(result.retryable, true);
  assert.equal(result.statusCode, 503);
});

test('marks network and timeout failures retryable', async () => {
  mockRequestFailure({ timeout: false });
  assert.equal((await sendEmail(email)).retryable, true);

  mockRequestFailure({ timeout: true });
  const timedOut = await sendEmail(email);
  assert.equal(timedOut.retryable, true);
  assert.match(timedOut.error, /timed out/);
});

test('requires configuration and all provider fields', async () => {
  delete process.env.RESEND_API_KEY;
  assert.equal((await sendEmail(email)).retryable, false);

  process.env.RESEND_API_KEY = 'test-key';
  assert.equal((await sendEmail({ ...email, text: undefined })).retryable, false);
});

test('parses and bounds Retry-After values', () => {
  assert.equal(parseRetryAfter('5'), 5000);
  assert.equal(parseRetryAfter('999999'), 60 * 60 * 1000);
  assert.equal(parseRetryAfter('invalid'), null);
});
