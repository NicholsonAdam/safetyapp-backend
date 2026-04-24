const express = require('express');
const router = express.Router();

const { uploadPhotos } = require("../middleware/upload");

const { getAllBBS, createBBS, updateBBSStatus } = require('../controllers/bbsController');

// GET all BBS observations
router.get('/', getAllBBS);

// POST new BBS observation (with optional photo)
router.post('/', uploadPhotos.single('photo'), createBBS);

router.patch('/:id', updateBBSStatus);

module.exports = router;
