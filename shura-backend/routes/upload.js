// routes/upload.js
const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

const router = express.Router();
const upload = multer({ dest: 'uploads/' }); // temporary upload folder

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});
console.log('Cloudinary env:', { 
  cloud: process.env.CLOUD_NAME, 
  hasKey: !!process.env.CLOUD_API_KEY 
});

router.post('/photo', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success:false, error: 'No file uploaded' });
    const result = await cloudinary.uploader.upload(req.file.path);
    return res.json({
      success: true,
      imageUrl: result.secure_url,
      publicId: result.public_id
    });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
