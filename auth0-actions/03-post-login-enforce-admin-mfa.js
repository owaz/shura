/**
 * Trigger: post-login
 * Execution order: 2 of 2 (after status/claim enforcement action)
 * Required secrets: none
 */
exports.onExecutePostLogin = async (event, api) => {
  const role = String(event?.user?.app_metadata?.role || '').toLowerCase();
  if (role !== 'admin') return;

  api.multifactor.enable('any', {
    allowRememberBrowser: false,
  });
};
