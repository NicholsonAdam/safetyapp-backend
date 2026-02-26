const express = require('express');
const router = express.Router();
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });

const { getAllBBS, createBBS, updateBBSStatus } = require('../controllers/bbsController');

// GET all BBS observations
router.get('/', getAllBBS);

// POST new BBS observation (with optional photo)
router.post('/', upload.single('photo'), createBBS);

router.patch('/:id', updateBBSStatus);

module.exports = router;