const db = require('../config/db');

async function getHighestScore(employeeId) {
  const result = await db.query(
    "SELECT MAX(score) AS highest_score FROM safety_quiz_scores WHERE employee_id = $1",
    [employeeId]
  );

  const highest = result.rows[0].highest_score;
  return highest ? Number(highest) : 0;
}

async function submitScore(employeeId, score) {
  const currentHighest = await getHighestScore(employeeId);

  if (score > currentHighest) {
    await db.query(
      "INSERT INTO safety_quiz_scores (employee_id, score) VALUES ($1, $2)",
      [employeeId, score]
    );
    return score;
  }

  return currentHighest;
}

module.exports = {
  getHighestScore,
  submitScore
};
