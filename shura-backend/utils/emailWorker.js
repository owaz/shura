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
  await purgeExpiredEmailData();
  return messages.length;
};

const startEmailWorker = ({
  processOutbox = processEmailOutbox,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
} = {}) => {
  if (process.env.EMAIL_OUTBOX_WORKER_ENABLED !== 'true') return null;
  let stopping = false;
  let currentRun = null;

  const run = () => {
    if (stopping || currentRun) return currentRun;
    currentRun = processOutbox()
      .catch((error) => {
        console.error('Email outbox worker failed:', error.message);
      })
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
