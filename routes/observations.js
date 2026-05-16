const express = require('express');
const router = express.Router();

const {
  createObservation,
  getObservations,
  updateObservationById,
  deleteObservationById
} = require('../controllers/observationsController');

router.post('/',           createObservation);
router.get('/',            getObservations);
router.put('/:id',         updateObservationById);
router.delete('/:id',      deleteObservationById);

module.exports = router;