const https = require('https');

const RESEND_API_URL = 'https://api.resend.com/emails';
const REQUEST_TIMEOUT_MS = 10000;

async function sendEmail(options) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    return { success: false, error: 'RESEND_API_KEY environment variable not configured' };
  }

  const { from, to, subject, html, text, idempotencyKey } = options;
  if (!from || !to || !subject || !html) {
    return { success: false, error: 'Missing required email fields: from, to, subject, html' };
  }

  const payload = JSON.stringify({
    from,
    to,
    subject,
    html,
    ...(text && { text }),
  });

  return new Promise((resolve) => {
    const req = https.request(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true, messageId: response.id });
          } else {
            resolve({ success: false, error: response.message || `HTTP ${res.statusCode}` });
          }
        } catch (error) {
          resolve({ success: false, error: `Failed to parse Resend response: ${error.message}` });
        }
      });
    });

    req.on('error', (error) => {
      resolve({ success: false, error: `Network error: ${error.message}` });
    });
    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error(`Resend request timed out after ${REQUEST_TIMEOUT_MS}ms`));
    });
    req.write(payload);
    req.end();
  });
}

module.exports = { sendEmail };
