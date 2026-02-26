const { 
  saveObservation, 
  getAllObservations, 
  updateObservation, 
  deleteObservation,
  updateObservationStatus
} = require('../services/observationsService');

exports.createObservation = async (req, res, next) => {
  try {
    const observation = req.body;

    const saved = await saveObservation(observation);

    res.json({
      status: 'success',
      message: 'Observation saved to database',
      data: saved
    });
  } catch (err) {
    next(err);
  }
};

exports.getObservations = async (req, res, next) => {
  try {
    const observations = await getAllObservations();

    res.json({
      status: 'success',
      message: 'Observations retrieved',
      data: observations
    });
  } catch (err) {
    next(err);
  }
};

exports.updateObservationById = async (req, res, next) => {
  try {
    const id = req.params.id;
    const observation = req.body;

    const updated = await observationsService.updateObservation(id, observation);

    if (!updated) {
      return res.status(404).json({
        status: 'error',
        message: `Observation with id ${id} not found`
      });
    }

    res.json({
      status: 'success',
      message: 'Observation updated',
      data: updated
    });
  } catch (err) {
    next(err);
  }
};

exports.deleteObservationById = async (req, res, next) => {
  try {
    const id = req.params.id;

    const deleted = await deleteObservation(id);

    if (!deleted) {
      return res.status(404).json({
        status: 'error',
        message: `Observation with id ${id} not found`
      });
    }

    res.json({
      status: 'success',
      message: 'Observation deleted',
      data: deleted
    });
  } catch (err) {
    next(err);
  }
};