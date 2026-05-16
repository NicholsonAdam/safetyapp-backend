const fs = require('fs');
const path = require('path');
const { getPhotosForObservation, savePhotoRecord } = require('../services/photosService');
const { getPhotoById, deletePhotoById } = require('../models/photosModel');

const UPLOAD_DIR = "/data/uploads";

exports.uploadPhotoForObservation = async (req, res, next) => {
  try {
    const observationId = req.params.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ status: 'error', message: 'No file uploaded' });
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const url = `${baseUrl}/files/${file.filename}`;

    const savedPhoto = await savePhotoRecord(observationId, file.filename, url);

    res.json({
      status: 'success',
      message: 'Photo uploaded and linked to observation',
      data: { observationId, photo: savedPhoto }
    });

  } catch (err) {
    next(err);
  }
};

exports.getPhotosForObservationController = async (req, res, next) => {
  try {
    const photos = await getPhotosForObservation(req.params.id);
    res.json({ status: 'success', message: 'Photos retrieved', data: photos });
  } catch (err) {
    next(err);
  }
};

exports.servePhotoFile = (req, res) => {
  const filePath = path.join(UPLOAD_DIR, req.params.fileName);
  res.sendFile(filePath);
};

exports.deletePhotoController = async (req, res, next) => {
  try {
    const photo = await getPhotoById(req.params.id);
    if (!photo) {
      return res.status(404).json({ status: 'error', message: 'Photo not found' });
    }

    const filename = photo.file_name || photo.filename || photo.url.split("/").pop();
    const filePath = path.join(UPLOAD_DIR, filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await deletePhotoById(req.params.id);

    res.json({ status: 'success', message: 'Photo deleted' });

  } catch (err) {
    next(err);
  }
};