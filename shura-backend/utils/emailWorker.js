const { sendEmail } = require('./resendAdapter');
const {
  claimEmails,
  markAccepted,
  markFailed,
  purgeExpiredEmailData,
} = require('./emailOutbox');

const WORK_INTERVAL_MS = 60000;

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
    if (result.success) await markAccepted(message.id, result.messageId);
    else await markFailed(message.id, result, message.attempts);
  }
  return messages.length;
};

const startEmailWorker = ({
  processOutbox = processEmailOutbox,
  purgeData = purgeExpiredEmailData,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
} = {}) => {
  const deliveryEnabled = process.env.EMAIL_OUTBOX_WORKER_ENABLED === 'true';
  let stopping = false;
  let currentRun = null;

  const run = () => {
    if (stopping || currentRun) return currentRun;
    currentRun = (async () => {
      if (deliveryEnabled) {
        try {
          await processOutbox();
        } catch (error) {
          console.error('Email outbox worker failed', { code: error?.code || 'EMAIL_WORKER_FAILED' });
        }
      }
      try {
        await purgeData();
      } catch (error) {
        console.error('Email retention cleanup failed', { code: error?.code || 'EMAIL_RETENTION_FAILED' });
      }
    })()
      .finally(() => {
        currentRun = null;
      });
    return currentRun;
  };

  void run();
  const interval = setIntervalFn(run, WORK_INTERVAL_MS);
  interval.unref();

  return {
    stop: async () => {
      stopping = true;
      clearIntervalFn(interval);
      if (currentRun) await currentRun;
    },
  };
};

module.exports = { processEmailOutbox, startEmailWorker };
