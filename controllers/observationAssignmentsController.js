const { getAssignments } = require('../services/observationAssignmentsService');

exports.fetchAssignments = async (req, res) => {
  try {
    const filters = {
      assigned_to_employee_id: req.query.assigned_to_employee_id,
      role: req.query.role,
      observation_id: req.query.observation_id
    };

    const assignments = await getAssignments(filters);

    res.status(200).json({
      status: 'success',
      message: 'Assignments retrieved',
      data: assignments
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};