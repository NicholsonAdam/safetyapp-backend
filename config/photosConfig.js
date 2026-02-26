const path = require('path');

const PHOTOS_BASE_DIR = 'Z:\\Adam\\SafetyApp\\Pictures';

module.exports = {
  PHOTOS_BASE_DIR,
  getPhotoFilePath: (fileName) => path.join(PHOTOS_BASE_DIR, fileName)
};