# Azure Blob Storage for Shura Images

All new backend image uploads use a private Azure Blob Storage container.
Database records store a stable blob name; API responses generate short-lived
read-only SAS URLs for browser display. Existing Cloudinary or external URLs
remain readable but no new uploads are sent to Cloudinary.

## Azure setup

1. Create or select a General Purpose v2 Storage Account.
2. Enable a system-assigned or user-assigned Managed Identity on the Shura
   backend host.
3. At storage-account scope, grant that identity:
   - `Storage Blob Data Contributor` for container and blob operations.
   - `Storage Blob Delegator` for short-lived user-delegation SAS URLs.
4. Set `AZURE_STORAGE_ACCOUNT_NAME` to the account name.
5. Optionally set `AZURE_STORAGE_IMAGE_CONTAINER`; it defaults to
   `shura-images` and is created privately on first use.
6. For a user-assigned identity, set `AZURE_CLIENT_ID`. A system-assigned
   identity needs no client ID.

Do not enable anonymous container access. The application intentionally uses
short-lived read-only URLs and stores no account keys in production.

## Local development

Set `AZURE_STORAGE_CONNECTION_STRING` to a development storage account or
Azurite connection string. When omitted outside production, the application
uses `DefaultAzureCredential` so an Azure CLI or developer credential can be
used.

## Existing image migration

Migration `010_azure_blob_image_storage.sql` labels existing profile and
attachment URLs as external or Cloudinary-backed. They continue to render.
A later data-migration job can copy those objects into Blob Storage, update the
blob-name/provider columns, verify checksums, and only then remove the source
objects. This code does not delete legacy Cloudinary content automatically.
