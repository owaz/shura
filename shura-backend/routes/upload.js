const express = require('express');
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const { errorResponse } = require('../utils/apiResponse');
const { uploadImage } = require('../services/azureBlobStorage');
const { sanitizeImageMetadata } = require('../utils/imageSanitization');

const router = express.Router();
const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const maxFileSizeBytes = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileSizeBytes, files: 1 },
  fileFilter: (_req, file, callback) => callback(null, allowedImageTypes.has(file.mimetype)),
});

const handleSingleImageUpload = (req, res, next) => upload.single('image')(req, res, (err) => {
  if (!err) return next();
  const message = err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
    ? 'Image must be 5 MB or smaller.'
    : 'Choose a JPG, PNG, WebP, or GIF image up to 5 MB.';
  return errorResponse(res, 400, 'INVALID_IMAGE_UPLOAD', message);
});

const hasValidImageSignature = (file) => {
  if (!file?.buffer) return false;
  const bytes = file.buffer;
  if (file.mimetype === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.mimetype === 'image/png') {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
  }
  if (file.mimetype === 'image/gif') return bytes.subarray(0, 6).toString('ascii') === 'GIF87a' || bytes.subarray(0, 6).toString('ascii') === 'GIF89a';
  if (file.mimetype === 'image/webp') return bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
  return false;
};

router.post('/photo', authenticateToken, handleSingleImageUpload, async (req, res) => {
  if (!req.file || !hasValidImageSignature(req.file)) {
    return errorResponse(res, 400, 'INVALID_IMAGE_UPLOAD', 'Choose a genuine JPG, PNG, WebP, or GIF image up to 5 MB.');
  }

  try {
    const result = await uploadImage({
      buffer: sanitizeImageMetadata(req.file.buffer, req.file.mimetype),
      mimeType: req.file.mimetype,
      namespace: `uploads/${req.user.role}/${req.user.id}`,
      metadata: { ownerType: req.user.role, ownerId: req.user.id, purpose: 'general-image' },
    });
    return res.json({
      success: true,
      imageUrl: result.readUrl,
      canonicalUrl: result.canonicalUrl,
      blobName: result.blobName,
      storageProvider: 'azure_blob',
    });
  } catch (err) {
    console.error('Azure Blob upload error', { code: err?.code || 'IMAGE_UPLOAD_FAILED' });
    return errorResponse(res, 500, 'IMAGE_UPLOAD_FAILED', 'The image could not be uploaded.');
  }
});

module.exports = router;
