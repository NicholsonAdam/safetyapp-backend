const express = require('express');
const router = express.Router();
const multer = require('multer');

const path = require("path");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

const {
  createInspection,
  getAllInspections,
  getInspectionById,
  updateInspectionStatus
} = require('../controllers/inspectionController');

// GET all inspections
router.get('/', getAllInspections);

// GET one inspection
router.get('/:id', getInspectionById);

// POST new inspection (with optional photo)
router.post('/', upload.single('photo'), createInspection);

// UPDATE status
router.patch('/:id', updateInspectionStatus);

module.exports = router;