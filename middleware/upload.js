const multer = require("multer");
const path = require("path");

const UPLOAD_DIR = "/data/uploads";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, unique + ext);
  }
});

const upload = multer({ storage });

module.exports = upload;
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure directories exist
const PHOTO_DIR = "/data/uploads";
const DOCUMENT_DIR = "/data/documents";

[PHOTO_DIR, DOCUMENT_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// PHOTO STORAGE (existing behavior)
const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, PHOTO_DIR);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, unique + ext);
  }
});

// DOCUMENT STORAGE (new)
const documentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, DOCUMENT_DIR);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, unique + ext);
  }
});

// Export two uploaders
const uploadPhotos = multer({ storage: photoStorage });
const uploadDocuments = multer({ storage: documentStorage });

module.exports = {
  uploadPhotos,
  uploadDocuments
};
