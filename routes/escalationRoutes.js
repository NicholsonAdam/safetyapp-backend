const express = require('express');
const router = express.Router();

const { escalate } = require('../controllers/escalationController');

router.post('/:id/escalate', escalate);

module.exports = router;