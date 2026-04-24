const multer = require("multer");
const path = require("path");
const fs = require("fs");

// DIRECTORIES
const PHOTO_DIR = "/data/uploads";
const DOCUMENT_DIR = "/data/documents";

// Ensure directories exist
[PHOTO_DIR, DOCUMENT_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// PHOTO STORAGE (BBS, Near Miss, Signatures, etc.)
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

// DOCUMENT STORAGE (PDF, DOCX, etc.)
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

// EXPORT TWO UPLOADERS
const uploadPhotos = multer({ storage: photoStorage });
const uploadDocuments = multer({ storage: documentStorage });

module.exports = {
  uploadPhotos,
  uploadDocuments
};
