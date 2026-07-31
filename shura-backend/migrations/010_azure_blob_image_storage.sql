-- Track Azure Blob names independently from display URLs. Existing Cloudinary
-- and external URLs remain readable, while every new upload uses Azure Blob.

ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture_blob_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture_storage_provider VARCHAR(30);

UPDATE users
SET profile_picture_storage_provider = CASE
  WHEN profile_picture_public_id IS NOT NULL THEN 'cloudinary'
  WHEN profile_picture IS NOT NULL THEN 'external'
  ELSE NULL
END
WHERE profile_picture_storage_provider IS NULL;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_profile_picture_storage_provider_check;
ALTER TABLE users ADD CONSTRAINT users_profile_picture_storage_provider_check
  CHECK (
    profile_picture_storage_provider IS NULL OR
    profile_picture_storage_provider IN ('azure_blob', 'cloudinary', 'external')
  );

ALTER TABLE therapists ADD COLUMN IF NOT EXISTS profile_image_blob_name TEXT;
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS profile_image_storage_provider VARCHAR(30);

UPDATE therapists
SET profile_image_storage_provider = 'external'
WHERE profile_image_url IS NOT NULL AND profile_image_storage_provider IS NULL;

ALTER TABLE therapists DROP CONSTRAINT IF EXISTS therapists_profile_image_storage_provider_check;
ALTER TABLE therapists ADD CONSTRAINT therapists_profile_image_storage_provider_check
  CHECK (
    profile_image_storage_provider IS NULL OR
    profile_image_storage_provider IN ('azure_blob', 'cloudinary', 'external')
  );

ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_blob_name TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_storage_provider VARCHAR(30);

UPDATE messages
SET file_storage_provider = 'external'
WHERE file_url IS NOT NULL AND file_storage_provider IS NULL;

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_file_storage_provider_check;
ALTER TABLE messages ADD CONSTRAINT messages_file_storage_provider_check
  CHECK (
    file_storage_provider IS NULL OR
    file_storage_provider IN ('azure_blob', 'cloudinary', 'external')
  );
