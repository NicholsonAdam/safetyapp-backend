const multer = require("multer");
const path = require("path");
const fs = require("fs");

const PHOTO_DIR = "/data/uploads";
const DOCUMENT_DIR = "/data/documents";

[PHOTO_DIR, DOCUMENT_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, PHOTO_DIR),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const documentStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, DOCUMENT_DIR),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const photoFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype);
  if (ext && mime) return cb(null, true);
  cb(new Error("Only image files are allowed"));
};

const documentFilter = (req, file, cb) => {
  const allowed = /pdf|docx|doc|xlsx|xls|csv|txt/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  if (ext) return cb(null, true);
  cb(new Error("Unsupported document type"));
};

const uploadPhotos = multer({ storage: photoStorage, fileFilter: photoFilter });
const uploadDocuments = multer({ storage: documentStorage, fileFilter: documentFilter });

module.exports = { uploadPhotos, uploadDocuments };