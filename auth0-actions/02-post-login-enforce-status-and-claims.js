/**
 * Trigger: post-login
 * Execution order: 1 of 2
 * Required secrets: none
 * Custom claim namespace: https://shura.com
 */
exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://shura.com';
  const role = String(event?.user?.app_metadata?.role || '').toLowerCase();
  const status = String(event?.user?.app_metadata?.status || 'active').toLowerCase();
  const connectionStrategy = String(event?.connection?.strategy || '').toLowerCase();
  const isSocial = !['auth0', 'waad', 'ad', 'email', 'sms'].includes(connectionStrategy);

  if (role === 'admin' && isSocial) {
    api.access.deny('unauthorized', 'Admin accounts must use email and password login.');
    return;
  }

  // Block all email/password users (clients, therapists, admins) from logging in
  // until they verify their email. Social logins (Google/Apple) are pre-verified.
  if (!isSocial && !event?.user?.email_verified) {
    api.access.deny('email_not_verified', 'Please verify your email address. Check your inbox (and junk folder) for the verification email from Shura.');
    return;
  }

  if (role === 'therapist') {
    if (isSocial) {
      api.access.deny('unauthorized', 'Therapist accounts must use email and password login.');
      return;
    }
    if (!event?.user?.email_verified) {
      api.access.deny('unauthorized', 'Please verify your email address before logging in.');
      return;
    }
    if (status === 'pending') {
      api.access.deny('unauthorized', "Your application is under review. You'll receive an email once approved.");
      return;
    }
    if (status === 'rejected') {
      api.access.deny('unauthorized', 'Your application was unsuccessful. Please contact support for more information.');
      return;
    }
    if (status === 'suspended') {
      api.access.deny('unauthorized', 'Your account is currently suspended. Please contact support.');
      return;
    }
  }

  api.idToken.setCustomClaim(`${namespace}/role`, role || 'client');
  api.idToken.setCustomClaim(`${namespace}/status`, status || 'active');
  api.accessToken.setCustomClaim(`${namespace}/role`, role || 'client');
  api.accessToken.setCustomClaim(`${namespace}/status`, status || 'active');
  // Include email in access token so the backend can look up / provision the user
  if (event.user.email) {
    api.accessToken.setCustomClaim(`${namespace}/email`, event.user.email);
  }
};
