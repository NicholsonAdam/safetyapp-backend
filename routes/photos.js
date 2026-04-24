const express = require('express');
const router = express.Router();

const { uploadPhotos } = require("../middleware/upload");

const {
  uploadPhotoForObservation,
  getPhotosForObservationController,
  servePhotoFile,
  deletePhotoController
} = require('../controllers/photosController');

router.post('/observations/:id/photo', uploadPhotos.single('photo'), uploadPhotoForObservation);

router.get('/observations/:id/photos', getPhotosForObservationController);

router.get('/photos/:fileName', servePhotoFile);

router.delete('/photos/:id', deletePhotoController);

module.exports = router;
