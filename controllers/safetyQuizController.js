const {
  getHighestScore,
  submitScore
} = require('../services/safetyQuizService');

async function getHighScoreController(req, res) {
  try {
    const employeeId = req.query.employeeId;

    if (!employeeId) {
      return res.status(400).json({ error: "employeeId is required" });
    }

    const highestScore = await getHighestScore(employeeId);
    return res.status(200).json({ highestScore });

  } catch (err) {
    console.error("Error in getHighScoreController:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

async function submitScoreController(req, res) {
  try {
    const { employeeId, score } = req.body;

    if (!employeeId || typeof score !== "number") {
      return res.status(400).json({ error: "Invalid payload" });
    }

    const highestScore = await submitScore(employeeId, score);
    return res.status(200).json({ highestScore });

  } catch (err) {
    console.error("Error in submitScoreController:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

module.exports = {
  getHighScoreController,
  submitScoreController
};
