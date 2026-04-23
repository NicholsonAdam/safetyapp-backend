const cron = require('node-cron');
const pool = require('../db');

const runMonthlyRollover = async () => {
    try {
        const now = new Date();

        // New month/year
        const newMonth = now.getMonth() + 1;
        const newYear = now.getFullYear();

        // Previous month/year
        let prevMonth = newMonth - 1;
        let prevYear = newYear;

        if (prevMonth === 0) {
            prevMonth = 12;
            prevYear = newYear - 1;
        }

        // Check if new month already has rows
        const checkQuery = `
            SELECT COUNT(*) 
            FROM submission_requirements
            WHERE month = $1 AND year = $2;
        `;
        const checkResult = await pool.query(checkQuery, [newMonth, newYear]);

        if (parseInt(checkResult.rows[0].count) > 0) {
            console.log(
                `Submission requirements for ${newMonth}/${newYear} already exist. Skipping rollover.`
            );
            return;
        }

        // Insert new rows based on previous month
        const insertQuery = `
            INSERT INTO submission_requirements (employee_id, required_count, year, month)
            SELECT employee_id, required_count, $1, $2
            FROM submission_requirements
            WHERE year = $3 AND month = $4;
        `;

        await pool.query(insertQuery, [newMonth, newYear, prevYear, prevMonth]);

        console.log(
            `Successfully rolled over submission requirements for ${newMonth}/${newYear}.`
        );
    } catch (err) {
        console.error("Error running monthly rollover:", err);
    }
};

// Run at 12:01 AM on the 1st of every month
cron.schedule('1 0 1 * *', runMonthlyRollover);

module.exports = runMonthlyRollover;

// DAILY SYNC — runs at 1:00 AM every day
cron.schedule('0 1 * * *', async () => {
    try {
        const model = require('../models/submissionRequirementsModel');
        await model.syncNewEmployees();
        console.log("Daily employee sync completed.");
    } catch (err) {
        console.error("Error running daily employee sync:", err);
    }
});
