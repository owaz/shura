const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const PROVIDERS = {
  google: {
    name: 'Google Calendar',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    scopes: [
      'openid',
      'email',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.freebusy',
    ],
  },
  outlook: {
    name: 'Outlook Calendar',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
    scopes: ['offline_access', 'User.Read', 'Calendars.ReadWrite'],
  },
};

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be configured in production');
  }
  return secret || 'shura_dev_jwt_secret_change_me';
};

const getTokenSecret = () => {
  const secret = process.env.CALENDAR_TOKEN_SECRET || process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('CALENDAR_TOKEN_SECRET must be configured in production');
  }
  return secret || 'shura_dev_calendar_token_secret_change_me';
};

const encryptionKey = () => crypto.createHash('sha256').update(getTokenSecret()).digest();

const encryptToken = (value) => {
  if (!value) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
};

const decryptToken = (value) => {
  if (!value) return null;
  const [ivText, tagText, encryptedText] = value.split('.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivText, 'base64'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, 'base64')),
    decipher.final(),
  ]).toString('utf8');
};

const publicBaseUrl = () => process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5001}`;
const frontendBaseUrl = () => process.env.FRONTEND_URL || 'http://127.0.0.1:5173';

const redirectUriFor = (provider) => {
  const envKey = provider === 'google' ? 'GOOGLE_CALENDAR_REDIRECT_URI' : 'OUTLOOK_CALENDAR_REDIRECT_URI';
  return process.env[envKey] || `${publicBaseUrl()}/api/calendar/${provider}/callback`;
};

const credentialsFor = (provider) => {
  const prefix = provider === 'google' ? 'GOOGLE_CALENDAR' : 'OUTLOOK_CALENDAR';
  return {
    clientId: process.env[`${prefix}_CLIENT_ID`],
    clientSecret: process.env[`${prefix}_CLIENT_SECRET`],
    redirectUri: redirectUriFor(provider),
  };
};

const providerConfig = (provider) => PROVIDERS[provider] || null;

const providerConfigured = (provider) => {
  const credentials = credentialsFor(provider);
  return Boolean(providerConfig(provider) && credentials.clientId && credentials.clientSecret);
};

const createOAuthState = ({ therapistId, provider }) => jwt.sign({
  therapistId,
  provider,
  purpose: 'calendar_oauth',
  nonce: crypto.randomBytes(16).toString('hex'),
}, getJwtSecret(), { expiresIn: '10m' });

const verifyOAuthState = (state, provider) => {
  const payload = jwt.verify(state, getJwtSecret());
  if (payload?.purpose !== 'calendar_oauth' || payload?.provider !== provider || !payload?.therapistId) {
    throw new Error('Invalid calendar authorization state');
  }
  return payload;
};

const buildAuthorizationUrl = ({ provider, therapistId }) => {
  const config = providerConfig(provider);
  const credentials = credentialsFor(provider);
  const params = new URLSearchParams({
    client_id: credentials.clientId,
    redirect_uri: credentials.redirectUri,
    response_type: 'code',
    scope: config.scopes.join(' '),
    state: createOAuthState({ therapistId, provider }),
  });

  if (provider === 'google') {
    params.set('access_type', 'offline');
    params.set('prompt', 'consent');
  } else {
    params.set('response_mode', 'query');
  }

  return `${config.authUrl}?${params.toString()}`;
};

const exchangeAuthorizationCode = async ({ provider, code }) => {
  const config = providerConfig(provider);
  const credentials = credentialsFor(provider);
  const body = new URLSearchParams({
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    code,
    redirect_uri: credentials.redirectUri,
    grant_type: 'authorization_code',
  });

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.error || 'Calendar token exchange failed');
  }

  return data;
};

const refreshAccessToken = async (integration) => {
  const provider = integration.provider;
  const config = providerConfig(provider);
  const credentials = credentialsFor(provider);
  const refreshToken = decryptToken(integration.refresh_token_enc);

  if (!refreshToken) {
    throw new Error(`No refresh token stored for ${provider}`);
  }

  const body = new URLSearchParams({
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.error || 'Calendar token refresh failed');
  }

  const expiresAt = new Date(Date.now() + Number(data.expires_in || 3600) * 1000);
  await pool.query(
    `UPDATE therapist_calendar_integrations
     SET access_token_enc = $1,
         refresh_token_enc = COALESCE($2, refresh_token_enc),
         expires_at = $3,
         updated_at = NOW(),
         last_error = NULL
     WHERE id = $4`,
    [encryptToken(data.access_token), data.refresh_token ? encryptToken(data.refresh_token) : null, expiresAt, integration.id]
  );

  return data.access_token;
};

const getAccessToken = async (integration) => {
  if (!integration.expires_at || new Date(integration.expires_at).getTime() - Date.now() < 120000) {
    return refreshAccessToken(integration);
  }
  return decryptToken(integration.access_token_enc);
};

const fetchProviderProfile = async ({ provider, accessToken }) => {
  const config = providerConfig(provider);
  const response = await fetch(config.userInfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json();
  if (!response.ok) return {};
  return {
    providerAccountId: data.id,
    providerAccountEmail: data.email || data.mail || data.userPrincipalName || null,
  };
};

const saveIntegration = async ({ therapistId, provider, tokenData }) => {
  const accessToken = tokenData.access_token;
  const refreshToken = tokenData.refresh_token;
  const expiresAt = new Date(Date.now() + Number(tokenData.expires_in || 3600) * 1000);
  const profile = await fetchProviderProfile({ provider, accessToken });

  await pool.query(
    `INSERT INTO therapist_calendar_integrations
      (therapist_id, provider, provider_account_id, provider_account_email, access_token_enc, refresh_token_enc, scopes, expires_at, status, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'connected', NOW())
     ON CONFLICT (therapist_id, provider)
     DO UPDATE SET provider_account_id = EXCLUDED.provider_account_id,
                   provider_account_email = EXCLUDED.provider_account_email,
                   access_token_enc = EXCLUDED.access_token_enc,
                   refresh_token_enc = COALESCE(EXCLUDED.refresh_token_enc, therapist_calendar_integrations.refresh_token_enc),
                   scopes = EXCLUDED.scopes,
                   expires_at = EXCLUDED.expires_at,
                   status = 'connected',
                   last_error = NULL,
                   updated_at = NOW()`,
    [
      therapistId,
      provider,
      profile.providerAccountId || null,
      profile.providerAccountEmail || null,
      encryptToken(accessToken),
      refreshToken ? encryptToken(refreshToken) : null,
      (tokenData.scope || providerConfig(provider).scopes.join(' ')),
      expiresAt,
    ]
  );
};

const parseBookingDate = (booking) => {
  const dateOnly = booking.date instanceof Date
    ? booking.date.toISOString().slice(0, 10)
    : String(booking.date).slice(0, 10);
  const time = String(booking.time || '09:00').padStart(5, '0');
  const start = new Date(`${dateOnly}T${time}:00+05:30`);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return { start, end };
};

const googleEventPayload = ({ booking, client, therapist }) => {
  const { start, end } = parseBookingDate(booking);
  return {
    summary: `Shura session with ${client.full_name || client.email}`,
    description: `Faith-centered therapy session booked through Shura.\nSession type: ${booking.session_type || 'video'}`,
    start: { dateTime: start.toISOString(), timeZone: 'Asia/Kolkata' },
    end: { dateTime: end.toISOString(), timeZone: 'Asia/Kolkata' },
    attendees: [
      { email: therapist.email },
      { email: client.email },
    ].filter((attendee) => attendee.email),
  };
};

const outlookEventPayload = ({ booking, client, therapist }) => {
  const { start, end } = parseBookingDate(booking);
  return {
    subject: `Shura session with ${client.full_name || client.email}`,
    body: {
      contentType: 'Text',
      content: `Faith-centered therapy session booked through Shura.\nSession type: ${booking.session_type || 'video'}`,
    },
    start: { dateTime: start.toISOString(), timeZone: 'Asia/Kolkata' },
    end: { dateTime: end.toISOString(), timeZone: 'Asia/Kolkata' },
    attendees: [
      { emailAddress: { address: therapist.email }, type: 'required' },
      { emailAddress: { address: client.email }, type: 'required' },
    ].filter((attendee) => attendee.emailAddress.address),
  };
};

const createProviderEvent = async ({ integration, booking, client, therapist }) => {
  const accessToken = await getAccessToken(integration);
  const provider = integration.provider;
  const endpoint = provider === 'google'
    ? 'https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all'
    : 'https://graph.microsoft.com/v1.0/me/events';
  const payload = provider === 'google'
    ? googleEventPayload({ booking, client, therapist })
    : outlookEventPayload({ booking, client, therapist });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || data.error_description || 'Calendar event creation failed');
  }
  return data;
};

const syncBookingToConnectedCalendars = async (bookingId) => {
  const { rows } = await pool.query(
    `SELECT b.*, u.full_name, u.email as client_email, t.email as therapist_email, t.full_name as therapist_name
     FROM bookings b
     JOIN users u ON u.id = b.user_id
     JOIN therapists t ON t.id = b.therapist_id
     WHERE b.id = $1`,
    [bookingId]
  );
  if (!rows.length) return;

  const booking = rows[0];
  const client = { full_name: booking.full_name, email: booking.client_email };
  const therapist = { full_name: booking.therapist_name, email: booking.therapist_email };
  const integrations = await pool.query(
    `SELECT * FROM therapist_calendar_integrations
     WHERE therapist_id = $1 AND status = 'connected'`,
    [booking.therapist_id]
  );

  for (const integration of integrations.rows) {
    try {
      const event = await createProviderEvent({ integration, booking, client, therapist });
      await pool.query(
        `INSERT INTO booking_calendar_events (booking_id, integration_id, provider, provider_event_id, provider_event_url, sync_status, synced_at)
         VALUES ($1, $2, $3, $4, $5, 'synced', NOW())
         ON CONFLICT (booking_id, integration_id)
         DO UPDATE SET provider_event_id = EXCLUDED.provider_event_id,
                       provider_event_url = EXCLUDED.provider_event_url,
                       sync_status = 'synced',
                       last_error = NULL,
                       synced_at = NOW()`,
        [
          booking.id,
          integration.id,
          integration.provider,
          event.id,
          event.htmlLink || event.webLink || null,
        ]
      );
    } catch (err) {
      await pool.query(
        `INSERT INTO booking_calendar_events (booking_id, integration_id, provider, sync_status, last_error)
         VALUES ($1, $2, $3, 'failed', $4)
         ON CONFLICT (booking_id, integration_id)
         DO UPDATE SET sync_status = 'failed', last_error = EXCLUDED.last_error`,
        [booking.id, integration.id, integration.provider, err.message]
      );
      await pool.query(
        `UPDATE therapist_calendar_integrations SET last_error = $1, updated_at = NOW() WHERE id = $2`,
        [err.message, integration.id]
      );
    }
  }
};

module.exports = {
  PROVIDERS,
  buildAuthorizationUrl,
  credentialsFor,
  exchangeAuthorizationCode,
  frontendBaseUrl,
  providerConfig,
  providerConfigured,
  saveIntegration,
  syncBookingToConnectedCalendars,
  verifyOAuthState,
};
