const { getDashboardFeed } = require('../services/dashboardService');

exports.fetchDashboardFeed = async (req, res) => {
  try {
    const filters = {
      assigned_to_employee_id: req.query.assigned_to_employee_id,
      role: req.query.role,
      status: req.query.status,
      area: req.query.area,
      start_date: req.query.start_date,
      end_date: req.query.end_date
    };

    const feed = await getDashboardFeed(filters);

    res.status(200).json({
      status: 'success',
      message: 'Dashboard feed retrieved',
      data: feed
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};