const express = require('express');
const router = express.Router();

const { fetchAssignments } = require('../controllers/observationAssignmentsController');

router.get('/', fetchAssignments);

module.exports = router;