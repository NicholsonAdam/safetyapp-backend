const { updateObservationStatus } = require('../services/observationsService');
const express = require('express');
const router = express.Router();
const observationsService = require('../services/observationsService');

const { 
  createObservation, 
  getObservations, 
  updateObservationById,
  deleteObservationById
} = require('../controllers/observationsController');

router.post('/', createObservation);
router.get('/', getObservations);
router.put('/:id', updateObservationById);
router.delete('/:id', deleteObservationById);
router.put('/:id/status', updateObservationStatus);

module.exports = router;