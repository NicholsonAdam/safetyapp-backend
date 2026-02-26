const express = require('express');
const router = express.Router();

const { fetchDashboardFeed } = require('../controllers/dashboardController');

router.get('/', fetchDashboardFeed);

module.exports = router;