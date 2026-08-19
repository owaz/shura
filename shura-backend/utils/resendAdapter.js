/**
 * Resend Email Adapter
 * Provides a simple HTTP-based email interface using Resend API
 * Replaces Nodemailer/Gmail SMTP transport
 */

const https = require('https');

const RESEND_API_URL = 'https://api.resend.com/emails';
const RESEND_API_KEY = process.env.RESEND_API_KEY;

/**
 * Send email via Resend API
 * @param {Object} options Email options
 * @param {string} options.from Sender email address
 * @param {string} options.to Recipient email address
 * @param {string} options.subject Email subject
 * @param {string} options.html Email body (HTML)
 * @param {string} options.text Email body (plain text, optional)
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
async function sendEmail(options) {
  if (!RESEND_API_KEY) {
    return {
      success: false,
      error: 'RESEND_API_KEY environment variable not configured',
    };
  }

  const { from, to, subject, html, text } = options;

  // Validate required fields
  if (!from || !to || !subject || !html) {
    return {
      success: false,
      error: 'Missing required email fields: from, to, subject, html',
    };
  }

  const payload = JSON.stringify({
    from,
    to,
    subject,
    html,
    ...(text && { text }),
  });

  return new Promise((resolve) => {
    const req = https.request(
      RESEND_API_URL,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);

            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({
                success: true,
                messageId: response.id,
              });
            } else {
              resolve({
                success: false,
                error: response.message || `HTTP ${res.statusCode}`,
              });
            }
          } catch (err) {
            resolve({
              success: false,
              error: `Failed to parse Resend response: ${err.message}`,
            });
          }
        });
      }
    );

    req.on('error', (err) => {
      resolve({
        success: false,
        error: `Network error: ${err.message}`,
      });
    });

    req.write(payload);
    req.end();
  });
}

module.exports = {
  sendEmail,
};
