const express = require('express');
const router = express.Router();
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });

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