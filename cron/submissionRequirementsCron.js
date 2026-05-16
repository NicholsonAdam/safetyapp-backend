const cron = require('node-cron');
const pool = require('../config/db');
const model = require('../models/submissionRequirementsModel');

const runMonthlyRollover = async () => {
  try {
    const now = new Date();

    const newMonth = now.getMonth() + 1;
    const newYear  = now.getFullYear();

    let prevMonth = newMonth - 1;
    let prevYear  = newYear;

    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear  = newYear - 1;
    }

    const checkResult = await pool.query(
      `SELECT COUNT(*) FROM submission_requirements WHERE month = $1 AND year = $2`,
      [newMonth, newYear]
    );

    if (parseInt(checkResult.rows[0].count) > 0) {
      console.log(`[Cron] Submission requirements for ${newMonth}/${newYear} already exist. Skipping.`);
      return;
    }

    await pool.query(
      `INSERT INTO submission_requirements (employee_id, required_count, year, month)
       SELECT employee_id, required_count, $1, $2
       FROM submission_requirements
       WHERE year = $3 AND month = $4`,
      [newMonth, newYear, prevYear, prevMonth]
    );

    console.log(`[Cron] Successfully rolled over submission requirements for ${newMonth}/${newYear}.`);
  } catch (err) {
    console.error("[Cron] Error running monthly rollover:", err);
  }
};

const runDailyEmployeeSync = async () => {
  try {
    await model.syncNewEmployees();
    console.log("[Cron] Daily employee sync completed.");
  } catch (err) {
    console.error("[Cron] Error running daily employee sync:", err);
  }
};

// Run at 12:01 AM on the 1st of every month
cron.schedule('1 0 1 * *', runMonthlyRollover);
console.log("[Cron] Monthly rollover scheduled — runs at 12:01 AM on the 1st.");

// Run at 1:00 AM every day
cron.schedule('0 1 * * *', runDailyEmployeeSync);
console.log("[Cron] Daily employee sync scheduled — runs at 1:00 AM.");

module.exports = runMonthlyRollover;