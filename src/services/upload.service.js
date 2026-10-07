const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Target local directory on the server PC
const UPLOAD_DIR = path.join(__dirname, '../../public/uploads/vehicles');

// Ensure directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer disk storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const jobCardId = req.params.id ? req.params.id.slice(0, 8) : 'general';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const safeBaseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `jc_${jobCardId}_${timestamp}_${safeBaseName}${ext}`);
  },
});

// File filter (accept images only)
const fileFilter = (req, file, cb) => {
  const allowedMime = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/avif'];
  if (allowedMime.includes(file.mimetype) || file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type "${file.mimetype}". Only image files are permitted.`), false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB limit per photo
  },
  fileFilter,
});

module.exports = {
  upload,
  UPLOAD_DIR,
};
