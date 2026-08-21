const pool = require('../db');
const { enqueueEmail } = require('./emailOutbox');

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const textValue = (value, fallback = 'Not provided') => {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value);
};

const frontendBaseUrl = () =>
  (process.env.FRONTEND_URL || 'http://localhost:3006').replace(/\/$/, '');
const frontendUrl = (path = '/') =>
  `${frontendBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;

const emailShell = (title, body) => `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f8f5f0">
    <div style="background:#fff;padding:28px;border-radius:12px;border-top:4px solid #8B7355">
      <h1 style="font-size:22px;color:#5C5043;margin-top:0">${escapeHtml(title)}</h1>
      ${body}
    </div>
  </div>
`;

const queueEmail = (mailOptions, emailType, queryable = pool) => {
  if (!mailOptions.idempotencyKey) {
    return Promise.resolve({ success: false, error: 'Email outbox requires an idempotency key' });
  }
  return enqueueEmail({
    eventKey: mailOptions.idempotencyKey,
    emailType,
    recipient: mailOptions.to,
    sender: process.env.RESEND_FROM_EMAIL,
    subject: mailOptions.subject,
    html: mailOptions.html,
    text: mailOptions.text,
  }, queryable);
};

const sendTherapistApplicationNotification = async (therapistData, queryable = pool) => {
  const applicationId = therapistData.applicationId;
  if (!applicationId) {
    return { success: false, error: 'applicationId is required for therapist application email' };
  }
  const reviewUrl = frontendUrl('/admin/therapists/pending');
  try {
    const result = await queueEmail({
      to: process.env.ADMIN_EMAIL,
      subject: 'New therapist application requires review',
      idempotencyKey: `therapist-application:${applicationId}`,
      html: emailShell('Therapist application received', `
        <p style="color:#555;line-height:1.6">A therapist application is ready for authorized review in Shura.</p>
        <p><a href="${escapeHtml(reviewUrl)}">Open pending therapist applications</a></p>
      `),
      text: `A therapist application is ready for authorized review in Shura.\n\n${reviewUrl}`,
    }, 'therapist_application', queryable);
    if (result.success) console.log('Email queued: therapist_application');
    return result;
  } catch (error) {
    console.error('Therapist application email queue failed:', error.message);
    return { success: false, error: error.message };
  }
};

const sendQuestionnaireAdminNotification = async (clientData, queryable = pool) => {
  if (!clientData.userId) {
    return { success: false, error: 'userId is required for questionnaire email' };
  }
  const reviewUrl = frontendUrl('/admin/clients');
  try {
    const result = await queueEmail({
      to: process.env.ADMIN_EMAIL,
      subject: 'Client questionnaire requires review',
      idempotencyKey: `questionnaire-submission:${clientData.userId}`,
      html: emailShell('Client questionnaire submitted', `
        <p style="color:#555;line-height:1.6">A client questionnaire is ready for authorized review in Shura.</p>
        <p><a href="${escapeHtml(reviewUrl)}">Open the admin portal</a></p>
      `),
      text: `A client questionnaire is ready for authorized review in Shura.\n\n${reviewUrl}`,
    }, 'questionnaire_submission', queryable);
    if (result.success) console.log('Email queued: questionnaire_submission');
    return result;
  } catch (error) {
    console.error('Questionnaire email queue failed:', error.message);
    return { success: false, error: error.message };
  }
};

const sendIntakeFormLink = async (
  clientEmail,
  clientName,
  intakeLink,
  intakeEventId,
  queryable = pool
) => {
  if (!intakeEventId) {
    return { success: false, error: 'intakeEventId is required for intake link email' };
  }
  const name = textValue(clientName, 'Client');
  try {
    const result = await queueEmail({
      to: clientEmail,
      subject: 'Complete your Shura intake form',
      idempotencyKey: `intake-link:${intakeEventId}`,
      html: emailShell('Complete your intake form', `
        <p style="color:#555;line-height:1.6">Dear ${escapeHtml(name)},</p>
        <p style="color:#555;line-height:1.6">Please complete your secure intake form before your first session.</p>
        <p><a href="${escapeHtml(intakeLink)}">Complete intake form</a></p>
        <p style="color:#777;font-size:14px">This single-use link expires in seven days. Do not forward it.</p>
      `),
      text: `Dear ${name},\n\nPlease complete your secure intake form before your first session:\n${intakeLink}\n\nThis single-use link expires in seven days. Do not forward it.`,
    }, 'intake_link', queryable);
    if (result.success) console.log('Email queued: intake_link');
    return result;
  } catch (error) {
    console.error('Intake link email queue failed:', error.message);
    return { success: false, error: error.message };
  }
};

const sendIntakeFormSubmission = async (intakeFormId, queryable = pool) => {
  if (!intakeFormId) {
    return { success: false, error: 'intakeFormId is required for intake submission email' };
  }
  const reviewUrl = frontendUrl('/admin/clients');
  try {
    const result = await queueEmail({
      to: process.env.ADMIN_EMAIL,
      subject: 'Client intake form requires review',
      idempotencyKey: `intake-submission:${intakeFormId}`,
      html: emailShell('Intake form submitted', `
        <p style="color:#555;line-height:1.6">A client completed an intake form. Sign in to Shura to review it securely.</p>
        <p><a href="${escapeHtml(reviewUrl)}">Open the admin portal</a></p>
      `),
      text: `A client completed an intake form. Sign in to Shura to review it securely.\n\n${reviewUrl}`,
    }, 'intake_submission', queryable);
    if (result.success) console.log('Email queued: intake_submission');
    return result;
  } catch (error) {
    console.error('Intake submission email queue failed:', error.message);
    return { success: false, error: error.message };
  }
};

const formatBookingDate = (value) => {
  if (!value) return 'your selected date';
  const parsed = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? String(value)
    : parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
};

const sendBookingConfirmation = async (bookingData, queryable = pool) => {
  try {
    if (!bookingData.clientId) {
      return { success: false, error: 'clientId is required for booking confirmation emails' };
    }
    const { rows } = await queryable.query(
      'SELECT notification_booking_confirmation FROM users WHERE id = $1',
      [bookingData.clientId]
    );
    if (rows.length === 0) {
      return { success: false, error: 'Booking confirmation client was not found' };
    }
    if (rows[0].notification_booking_confirmation === false) {
      console.log(`Email skipped: booking_confirmation (${bookingData.bookingId})`);
      return { success: true, skipped: true };
    }

    const date = formatBookingDate(bookingData.date);
    const time = textValue(String(bookingData.time || '').slice(0, 5), 'the selected time');
    const therapistName = textValue(bookingData.therapistName, 'your therapist');
    const sessionType = textValue(bookingData.sessionType, 'session');
    const result = await queueEmail({
      to: bookingData.clientEmail,
      subject: 'Your Shura session is booked',
      idempotencyKey: `booking-confirmation:${bookingData.bookingId}`,
      html: emailShell('Your session is confirmed', `
        <p style="color:#555;line-height:1.6">Dear ${escapeHtml(textValue(bookingData.clientName, 'Client'))},</p>
        <p style="color:#555;line-height:1.6">Your session with ${escapeHtml(therapistName)} has been booked.</p>
        <p style="color:#555"><strong>Session:</strong> ${escapeHtml(sessionType)}<br>
        <strong>Date:</strong> ${escapeHtml(date)}<br><strong>Time:</strong> ${escapeHtml(time)}</p>
      `),
      text: `Your session with ${therapistName} is booked.\nSession: ${sessionType}\nDate: ${date}\nTime: ${time}`,
    }, 'booking_confirmation', queryable);
    if (result.success) console.log('Email queued: booking_confirmation');
    return result;
  } catch (error) {
    console.error('Booking confirmation email queue failed:', error.message);
    return { success: false, error: error.message };
  }
};

const sendBookingNotificationToTherapist = async (bookingData, queryable = pool) => {
  const date = formatBookingDate(bookingData.date);
  const time = textValue(String(bookingData.time || '').slice(0, 5), 'the selected time');
  const clientName = textValue(bookingData.clientName, 'A client');
  const sessionType = textValue(bookingData.sessionType, 'session');
  try {
    const result = await queueEmail({
      to: bookingData.therapistEmail,
      subject: 'New Shura session booking',
      idempotencyKey: `booking-therapist-notification:${bookingData.bookingId}`,
      html: emailShell('New session booking', `
        <p style="color:#555;line-height:1.6">${escapeHtml(clientName)} booked a session with you.</p>
        <p style="color:#555"><strong>Session:</strong> ${escapeHtml(sessionType)}<br>
        <strong>Date:</strong> ${escapeHtml(date)}<br><strong>Time:</strong> ${escapeHtml(time)}</p>
      `),
      text: `${clientName} booked a session with you.\nSession: ${sessionType}\nDate: ${date}\nTime: ${time}`,
    }, 'booking_notification', queryable);
    if (result.success) console.log('Email queued: booking_notification');
    return result;
  } catch (error) {
    console.error('Therapist booking email queue failed:', error.message);
    return { success: false, error: error.message };
  }
};

const sendTherapistReleaseNotification = async (data, queryable = pool) => {
  if (!data.assignmentId) {
    return { success: false, error: 'assignmentId is required for therapist release email' };
  }
  const therapistName = textValue(data.therapistName, 'Therapist');
  const clientName = textValue(data.clientName, 'A client');
  try {
    const result = await queueEmail({
      to: data.therapistEmail,
      subject: 'Shura client assignment update',
      idempotencyKey: `therapist-release:${data.assignmentId}`,
      html: emailShell('Client assignment update', `
        <p style="color:#555;line-height:1.6">Assalamu Alaikum ${escapeHtml(therapistName)},</p>
        <p style="color:#555;line-height:1.6">${escapeHtml(clientName)} has requested a different therapist. The active assignment has been released.</p>
      `),
      text: `Assalamu Alaikum ${therapistName},\n\n${clientName} has requested a different therapist. The active assignment has been released.`,
    }, 'therapist_release', queryable);
    if (result.success) console.log('Email queued: therapist_release');
    return result;
  } catch (error) {
    console.error('Therapist release email queue failed:', error.message);
    return { success: false, error: error.message };
  }
};

const formatSessionDateTime = (value, timezone = 'UTC') => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return textValue(value, 'the scheduled time');
  try {
    return date.toLocaleString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone,
      timeZoneName: 'short',
    });
  } catch {
    return date.toISOString();
  }
};

const sendSessionRescheduledNotifications = async (
  session,
  sessionEventId,
  queryable = pool
) => {
  if (!sessionEventId) {
    return { success: false, error: 'sessionEventId is required for reschedule emails' };
  }
  const oldTime = formatSessionDateTime(
    session.previousScheduledAt,
    session.client_timezone || session.clientTimezone
  );
  const newTime = formatSessionDateTime(
    session.nextScheduledAt,
    session.client_timezone || session.clientTimezone
  );
  const panel = `<p style="color:#555"><strong>Previous time:</strong> ${escapeHtml(oldTime)}<br><strong>New time:</strong> ${escapeHtml(newTime)}</p>`;
  try {
    const results = await Promise.all([
      queueEmail({
        to: session.client_email || session.clientEmail,
        subject: 'Your Shura session has been rescheduled',
        idempotencyKey: `session-rescheduled:client:${sessionEventId}`,
        html: emailShell('Session rescheduled', `
          <p style="color:#555">Your session with ${escapeHtml(textValue(session.therapist_name || session.therapistName, 'your therapist'))} has moved.</p>${panel}
        `),
        text: `Your Shura session has moved.\nPrevious time: ${oldTime}\nNew time: ${newTime}`,
      }, 'session_rescheduled', queryable),
      queueEmail({
        to: session.therapist_email || session.therapistEmail,
        subject: 'A Shura session has been rescheduled',
        idempotencyKey: `session-rescheduled:therapist:${sessionEventId}`,
        html: emailShell('Session rescheduled', `
          <p style="color:#555">${escapeHtml(textValue(session.client_name || session.clientName, 'A client'))} moved their session.</p>${panel}
        `),
        text: `A client moved their Shura session.\nPrevious time: ${oldTime}\nNew time: ${newTime}`,
      }, 'session_rescheduled', queryable),
    ]);
    return { success: results.every((result) => result.success), results };
  } catch (error) {
    console.error('Reschedule email queue failed:', error.message);
    return { success: false, error: error.message };
  }
};

const sendSessionCancellationNotifications = async (session, queryable = pool) => {
  const bookingId = session.booking_id || session.bookingId || session.id;
  if (!bookingId) {
    return { success: false, error: 'bookingId is required for cancellation emails' };
  }
  const sessionTime = formatSessionDateTime(
    session.scheduled_at || session.scheduledAt,
    session.client_timezone || session.clientTimezone
  );
  const refundNote = session.refundEligible
    ? 'Refund progress is available in your Shura billing history.'
    : 'This cancellation is outside the refundable window.';
  try {
    const results = await Promise.all([
      queueEmail({
        to: session.client_email || session.clientEmail,
        subject: 'Your Shura session has been cancelled',
        idempotencyKey: `session-cancelled:client:${bookingId}`,
        html: emailShell('Session cancelled', `
          <p style="color:#555">Your session with ${escapeHtml(textValue(session.therapist_name || session.therapistName, 'your therapist'))} has been cancelled.</p>
          <p style="color:#555"><strong>Original time:</strong> ${escapeHtml(sessionTime)}</p>
          <p style="color:#555">${escapeHtml(refundNote)}</p>
        `),
        text: `Your Shura session has been cancelled.\nOriginal time: ${sessionTime}\n${refundNote}`,
      }, 'session_cancelled', queryable),
      queueEmail({
        to: session.therapist_email || session.therapistEmail,
        subject: 'A Shura session has been cancelled',
        idempotencyKey: `session-cancelled:therapist:${bookingId}`,
        html: emailShell('Session cancelled', `
          <p style="color:#555">${escapeHtml(textValue(session.client_name || session.clientName, 'A client'))} cancelled their session.</p>
          <p style="color:#555"><strong>Original time:</strong> ${escapeHtml(sessionTime)}</p>
        `),
        text: `A client cancelled their Shura session.\nOriginal time: ${sessionTime}`,
      }, 'session_cancelled', queryable),
    ]);
    return { success: results.every((result) => result.success), results };
  } catch (error) {
    console.error('Cancellation email queue failed:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendBookingConfirmation,
  sendBookingNotificationToTherapist,
  sendIntakeFormLink,
  sendIntakeFormSubmission,
  sendQuestionnaireAdminNotification,
  sendSessionCancellationNotifications,
  sendSessionRescheduledNotifications,
  sendTherapistApplicationNotification,
  sendTherapistReleaseNotification,
};
