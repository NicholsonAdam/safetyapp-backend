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

    // Correct variable name
    const filename = file.filename;

    // Correct single baseUrl + files path
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const url = `${baseUrl}/files/${filename}`;

    // Save DB record with correct variable
    const savedPhoto = await savePhotoRecord(observationId, filename, url);

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
exports.servePhotoFile = (req, res) => {
  const filePath = path.join("/data/uploads", req.params.fileName);
  res.sendFile(filePath);
};

// -----------------------------------------------------
// DELETE a photo
// -----------------------------------------------------
exports.deletePhotoController = async (req, res) => {
  try {
    const { id } = req.params;

    const photo = await getPhotoById(id);
    if (!photo) {
      return res.status(404).json({
        status: 'error',
        message: 'Photo not found'
      });
    }

    const filename = photo.file_name || photo.filename || photo.url.split("/").pop();
    const filePath = path.join("/data/uploads", filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

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
