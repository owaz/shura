// routes/upload.js
const express = require('express');
const fs = require('fs/promises');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { authenticateToken } = require('../middleware/auth');
require('dotenv').config();

const router = express.Router();

const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const maxFileSizeBytes = 5 * 1024 * 1024;
fs.mkdir('uploads', { recursive: true }).catch((err) => {
  console.error('Failed to ensure upload directory exists:', err);
});

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: maxFileSizeBytes, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!allowedImageTypes.has(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'));
    }
    return cb(null, true);
  },
});

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

const handleSingleImageUpload = (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'Image must be 5MB or smaller'
        : err.message;
      return res.status(400).json({ success: false, error: message });
    }

    return res.status(400).json({ success: false, error: err.message || 'Invalid upload' });
  });
};

router.post('/photo', authenticateToken, handleSingleImageUpload, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });

    const result = await cloudinary.uploader.upload(req.file.path, {
      resource_type: 'image',
      folder: process.env.CLOUDINARY_UPLOAD_FOLDER || 'shura/uploads',
    });

    return res.json({
      success: true,
      imageUrl: result.secure_url,
      publicId: result.public_id,
    });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ success: false, error: 'Failed to upload image' });
  } finally {
    if (req.file?.path) {
      await fs.unlink(req.file.path).catch(() => {});
    }
  }
});

module.exports = router;
