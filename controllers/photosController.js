const fs = require('fs');
const path = require('path');
const { getPhotosForObservation, savePhotoRecord } = require('../services/photosService');
const { getPhotoFilePath } = require('../config/photosConfig');
const { getPhotoById, deletePhotoById } = require('../models/photosModel');

exports.uploadPhotoForObservation = async (req, res, next) => {
  try {
    const observationId = req.params.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        status: 'error',
        message: 'No file uploaded'
      });
    }

    // Save file to disk
    const fileName = `observation-${observationId}-${Date.now()}-${file.originalname}`;
    const filePath = getPhotoFilePath(fileName);
    fs.writeFileSync(filePath, file.buffer);

    // Build URL
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const url = `${baseUrl}/api/photos/${fileName}`;

    // Save DB record
    const savedPhoto = await savePhotoRecord(observationId, fileName, url);

    res.json({
      status: 'success',
      message: 'Photo uploaded and linked to observation',
      data: {
        observationId,
        photo: savedPhoto
      }
    });

  } catch (err) {
    next(err);
  }
};
// -----------------------------------------------------
// GET all photos for an observation
// -----------------------------------------------------
exports.getPhotosForObservationController = async (req, res, next) => {
  try {
    const observationId = req.params.id;
    const photos = await getPhotosForObservation(observationId);

    res.json({
      status: 'success',
      message: 'Photos retrieved',
      data: photos
    });
  } catch (err) {
    next(err);
  }
};

// -----------------------------------------------------
// SERVE a photo file
// -----------------------------------------------------
exports.servePhotoFile = (req, res, next) => {
  try {
    const fileName = req.params.fileName;
    const fullPath = getPhotoFilePath(fileName);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).send('File not found');
    }

    res.sendFile(path.resolve(fullPath));
  } catch (err) {
    next(err);
  }
};

// -----------------------------------------------------
// DELETE a photo
// -----------------------------------------------------
exports.deletePhotoController = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Look up the photo in the DB
    const photo = await getPhotoById(id);
    if (!photo) {
      return res.status(404).json({
        status: 'error',
        message: 'Photo not found'
      });
    }

    // Extract filename from URL
    const fileName = photo.url.split('/').pop();
    const filePath = getPhotoFilePath(fileName);

    // 2. Delete the file from disk
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // 3. Delete the DB row
    await deletePhotoById(id);

    return res.json({
      status: 'success',
      message: 'Photo deleted'
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to delete photo'
    });
  }
};

// -----------------------------------------------------
// EXPORT ALL CONTROLLERS
// -----------------------------------------------------
module.exports = {
  uploadPhotoForObservation: exports.uploadPhotoForObservation,
  getPhotosForObservationController: exports.getPhotosForObservationController,
  servePhotoFile: exports.servePhotoFile,
  deletePhotoController: exports.deletePhotoController
};