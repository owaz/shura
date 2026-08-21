const https = require('https');

const RESEND_API_URL = 'https://api.resend.com/emails';
const REQUEST_TIMEOUT_MS = 10000;
const MAX_RESPONSE_BYTES = 64 * 1024;
const MAX_RETRY_AFTER_MS = 60 * 60 * 1000;

const boundedError = (value, fallback) => String(value || fallback).slice(0, 500);

const parseRetryAfter = (value, now = Date.now()) => {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
  }
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return null;
  return Math.min(Math.max(0, date - now), MAX_RETRY_AFTER_MS);
};

async function sendEmail(options) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    return {
      success: false,
      error: 'RESEND_API_KEY environment variable not configured',
      retryable: false,
    };
  }
  const { from, to, subject, html, text, idempotencyKey } = options;
  if (!from || !to || !subject || !html || !text || !idempotencyKey) {
    return {
      success: false,
      error: 'Missing required Resend email fields',
      retryable: false,
    };
  }

  const payload = JSON.stringify({ from, to, subject, html, ...(text && { text }) });
  return new Promise((resolve) => {
    const req = https.request(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Idempotency-Key': idempotencyKey,
      },
    }, (res) => {
      let data = '';
      let bytes = 0;
      res.on('data', (chunk) => {
        bytes += chunk.length;
        if (bytes > MAX_RESPONSE_BYTES) {
          res.destroy(new Error('Resend response exceeded the maximum size'));
          return;
        }
        data += chunk;
      });
      res.on('error', (error) => {
        resolve({
          success: false,
          error: boundedError(error.message, 'Resend response error'),
          retryable: true,
        });
      });
      res.on('end', () => {
        let response = {};
        try {
          response = data ? JSON.parse(data) : {};
        } catch {
          resolve({
            success: false,
            error: 'Resend returned an invalid response',
            retryable: Number(res.statusCode) >= 500,
            statusCode: res.statusCode,
          });
          return;
        }

        if (res.statusCode >= 200 && res.statusCode < 300 && response.id) {
          resolve({ success: true, messageId: response.id, statusCode: res.statusCode });
          return;
        }

        const statusCode = Number(res.statusCode) || 0;
        resolve({
          success: false,
          error: boundedError(response.message, `Resend HTTP ${statusCode}`),
          retryable: statusCode === 429 || statusCode >= 500,
          retryAfterMs: parseRetryAfter(res.headers['retry-after']),
          statusCode,
        });
      });
    });
    req.on('error', (error) => {
      resolve({
        success: false,
        error: boundedError(error.message, 'Resend network error'),
        retryable: true,
      });
    });
    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error(`Resend request timed out after ${REQUEST_TIMEOUT_MS}ms`));
    });
    req.write(payload);
    req.end();
  });
}

module.exports = { parseRetryAfter, sendEmail };
