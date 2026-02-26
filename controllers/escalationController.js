const { escalateObservation } = require('../services/escalationService');

exports.escalate = async (req, res) => {
  try {
    const { id } = req.params;
    const { from_employee_id, to_employee_id, reason } = req.body;

    const result = await escalateObservation(
      id,
      from_employee_id,
      to_employee_id,
      reason
    );

    res.status(200).json({
      status: 'success',
      message: 'Observation escalated',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};