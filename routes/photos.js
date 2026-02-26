const express = require('express');
const router = express.Router();
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });

const {
  uploadPhotoForObservation,
  getPhotosForObservationController,
  servePhotoFile,
  deletePhotoController
} = require('../controllers/photosController');

router.post('/observations/:id/photo', upload.single('photo'), uploadPhotoForObservation);

router.get('/observations/:id/photos', getPhotosForObservationController);

router.get('/photos/:fileName', servePhotoFile);

router.delete('/photos/:id', deletePhotoController);

module.exports = router;