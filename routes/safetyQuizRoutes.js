const express = require('express');
const router = express.Router();

const {
  getHighScoreController,
  submitScoreController
} = require('../controllers/safetyQuizController');

// GET /api/safety-quiz/high-score?employeeId=123
router.get('/high-score', getHighScoreController);

// POST /api/safety-quiz/submit-score
router.post('/submit-score', submitScoreController);

module.exports = router;
