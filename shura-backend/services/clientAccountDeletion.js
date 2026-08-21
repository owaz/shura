const pool = require('../db');
const { deleteImage } = require('./azureBlobStorage');
const {
  deleteUser: deleteAuth0User,
  setBlocked,
} = require('./auth0Management');

const deleteClientAccount = async ({ clientId, auth0Sub }, dependencies = {}) => {
  const database = dependencies.pool || pool;
  const blockIdentity = dependencies.setBlocked || setBlocked;
  const removeIdentity = dependencies.deleteAuth0User || deleteAuth0User;
  const removeImage = dependencies.deleteImage || deleteImage;

  const { rows } = await database.query(
    `UPDATE users
     SET account_deletion_requested_at = COALESCE(account_deletion_requested_at, NOW()),
         status = 'suspended',
         updated_at = NOW()
     WHERE id = $1
     RETURNING profile_picture_blob_name, profile_picture_storage_provider`,
    [clientId]
  );
  if (!rows.length) {
    const error = new Error('Client not found');
    error.code = 'CLIENT_NOT_FOUND';
    throw error;
  }

  // Keep the local row until Auth0 deletion succeeds. A provider failure leaves
  // a blocked, marked record that operations can find and safely reconcile.
  await blockIdentity(auth0Sub, true);
  await removeIdentity(auth0Sub);
  await database.query('DELETE FROM users WHERE id = $1', [clientId]);

  const blobName = rows[0].profile_picture_blob_name;
  if (rows[0].profile_picture_storage_provider === 'azure_blob' && blobName) {
    await removeImage(blobName).catch((error) => {
      console.error('Deleted account image cleanup failed', { code: error?.code || 'IMAGE_DELETE_FAILED' });
    });
  }
};

module.exports = { deleteClientAccount };
