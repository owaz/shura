const crypto = require('crypto');
const {
  BlobSASPermissions,
  BlobServiceClient,
  SASProtocol,
  generateBlobSASQueryParameters,
} = require('@azure/storage-blob');
const { DefaultAzureCredential, ManagedIdentityCredential } = require('@azure/identity');

let serviceClient;
let containerClient;
let accountName;
let usesConnectionString = false;
let containerReady;
let cachedDelegationKey;
let cachedDelegationKeyExpiresAt = 0;

const containerName = () => (process.env.AZURE_STORAGE_IMAGE_CONTAINER || 'shura-images').trim();

const assertContainerName = (value) => {
  if (!/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/.test(value)) {
    throw new Error('AZURE_STORAGE_IMAGE_CONTAINER must be a valid lowercase Azure Blob container name');
  }
};

const getClients = () => {
  if (serviceClient && containerClient) return { serviceClient, containerClient, accountName };

  const connectionString = (process.env.AZURE_STORAGE_CONNECTION_STRING || '').trim();
  const configuredAccountName = (process.env.AZURE_STORAGE_ACCOUNT_NAME || '').trim();
  const imageContainer = containerName();
  assertContainerName(imageContainer);

  if (connectionString) {
    usesConnectionString = true;
    serviceClient = BlobServiceClient.fromConnectionString(connectionString);
    accountName = serviceClient.accountName;
  } else {
    if (!configuredAccountName) {
      throw new Error('AZURE_STORAGE_ACCOUNT_NAME or AZURE_STORAGE_CONNECTION_STRING is required');
    }
    accountName = configuredAccountName;
    const credential = process.env.NODE_ENV === 'production'
      ? new ManagedIdentityCredential(
        process.env.AZURE_CLIENT_ID ? { clientId: process.env.AZURE_CLIENT_ID } : undefined
      )
      : new DefaultAzureCredential();
    serviceClient = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      credential
    );
  }

  containerClient = serviceClient.getContainerClient(imageContainer);
  return { serviceClient, containerClient, accountName };
};

const ensureContainer = async () => {
  const { containerClient: client } = getClients();
  if (!containerReady) {
    containerReady = client.createIfNotExists({ metadata: { purpose: 'shura-private-images' } })
      .catch((err) => {
        containerReady = null;
        throw err;
      });
  }
  await containerReady;
  return client;
};

const extensionForMime = (mimeType) => ({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
})[mimeType] || 'bin';

const safeNamespace = (value) => String(value || 'uploads')
  .toLowerCase()
  .replace(/[^a-z0-9/_-]+/g, '-')
  .replace(/\.{2,}/g, '')
  .replace(/^[\/-]+|[\/-]+$/g, '') || 'uploads';

const createBlobName = (namespace, mimeType) =>
  `${safeNamespace(namespace)}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extensionForMime(mimeType)}`;

const uploadImage = async ({ buffer, mimeType, namespace, metadata = {} }) => {
  const client = await ensureContainer();
  const blobName = createBlobName(namespace, mimeType);
  const blob = client.getBlockBlobClient(blobName);
  await blob.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: mimeType,
      blobCacheControl: 'private, max-age=300, no-transform',
      blobContentDisposition: 'inline',
    },
    metadata: Object.fromEntries(
      Object.entries({ ...metadata, storageProvider: 'azure-blob' })
        .filter(([, value]) => value !== null && value !== undefined)
        .map(([key, value]) => [key, String(value).replace(/[^\x20-\x7E]/g, '')])
    ),
  });
  return {
    blobName,
    canonicalUrl: blob.url,
    readUrl: await getImageReadUrl(blobName),
  };
};

const getDelegationKey = async (startsOn, expiresOn) => {
  const { serviceClient: client } = getClients();
  if (cachedDelegationKey && cachedDelegationKeyExpiresAt > expiresOn.getTime() + 60_000) {
    return cachedDelegationKey;
  }
  const keyExpiresOn = new Date(Date.now() + 60 * 60 * 1000);
  cachedDelegationKey = await client.getUserDelegationKey(startsOn, keyExpiresOn);
  cachedDelegationKeyExpiresAt = keyExpiresOn.getTime();
  return cachedDelegationKey;
};

const getImageReadUrl = async (blobName) => {
  if (!blobName) return '';
  const client = await ensureContainer();
  const blob = client.getBlockBlobClient(blobName);
  const ttlMinutes = Math.min(60, Math.max(5, Number(process.env.AZURE_STORAGE_SAS_TTL_MINUTES) || 15));
  const startsOn = new Date(Date.now() - 5 * 60 * 1000);
  const expiresOn = new Date(Date.now() + ttlMinutes * 60 * 1000);

  if (usesConnectionString) {
    return blob.generateSasUrl({ permissions: BlobSASPermissions.parse('r'), startsOn, expiresOn, protocol: SASProtocol.Https });
  }

  const delegationKey = await getDelegationKey(startsOn, expiresOn);
  const query = generateBlobSASQueryParameters({
    containerName: containerName(),
    blobName,
    permissions: BlobSASPermissions.parse('r'),
    startsOn,
    expiresOn,
    protocol: SASProtocol.Https,
  }, delegationKey, accountName).toString();
  return `${blob.url}?${query}`;
};

const getCanonicalImageUrl = (blobName) => {
  if (!blobName) return '';
  const { containerClient: client } = getClients();
  return client.getBlockBlobClient(blobName).url;
};

const deleteImage = async (blobName) => {
  if (!blobName) return false;
  const client = await ensureContainer();
  const response = await client.deleteBlob(blobName, { deleteSnapshots: 'include' });
  return !response.errorCode;
};

module.exports = {
  createBlobName,
  deleteImage,
  getCanonicalImageUrl,
  getImageReadUrl,
  uploadImage,
};
