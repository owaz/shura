/**
 * Trigger: pre-user-registration
 * Execution order: 1 of 1
 * Required secrets: none
 * Notes:
 * - Reads intended role from query parameter "role" or user_metadata.intended_role.
 * - Denies admin self-registration.
 */
exports.onExecutePreUserRegistration = async (event, api) => {
  const intendedRole = String(
    event?.request?.query?.role ||
    event?.user?.user_metadata?.intended_role ||
    'client'
  ).toLowerCase();

  if (intendedRole === 'admin') {
    api.access.deny('invalid_request', 'Admin accounts cannot self-register.');
    return;
  }

  if (intendedRole === 'therapist') {
    api.user.setAppMetadata('role', 'therapist');
    api.user.setAppMetadata('status', 'pending');
    return;
  }

  api.user.setAppMetadata('role', 'client');
  api.user.setAppMetadata('status', 'active');
};
