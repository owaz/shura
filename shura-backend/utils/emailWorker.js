const { sendEmail } = require('./resendAdapter');
const { claimEmails, markSent, markFailed } = require('./emailOutbox');

const processEmailOutbox = async () => {
  const messages = await claimEmails();
  for (const message of messages) {
    const result = await sendEmail({
      from: message.sender,
      to: message.recipient,
      subject: message.subject,
      html: message.html_body,
      text: message.text_body,
      idempotencyKey: message.event_key,
    });
    if (result.success) await markSent(message.id, result.messageId);
    else await markFailed(message.id, result.error, message.attempts);
  }
  return messages.length;
};

const startEmailWorker = () => {
  if (process.env.EMAIL_OUTBOX_ENABLED !== 'true') return null;
  const interval = setInterval(() => {
    processEmailOutbox().catch((error) => {
      console.error('Email outbox worker failed:', error.message);
    });
  }, 60000);
  interval.unref();
  return interval;
};

module.exports = { processEmailOutbox, startEmailWorker };
