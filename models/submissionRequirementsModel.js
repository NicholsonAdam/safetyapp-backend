const pool = require('../db');

// Get all submission requirements with employee + leader info
const getAllSubmissionRequirements = async () => {
    const query = `
        SELECT 
            sr.employee_id,
            e.name AS employee_name,
            e.leader_id,
            l.email AS leader_email,
            sr.required_count,
            sr.year,
            sr.month,
            sr.created_at,
            sr.updated_at
        FROM submission_requirements sr
        JOIN employees e 
            ON sr.employee_id = e.employee_id
        LEFT JOIN employees l
            ON e.leader_id = l.employee_id
        ORDER BY sr.year DESC, sr.month DESC;
    `;
    const result = await pool.query(query);
    return result.rows;
};

// Insert new requirement
const createSubmissionRequirement = async (data) => {
    const query = `
        INSERT INTO submission_requirements 
            (employee_id, required_count, year, month)
        VALUES ($1, $2, $3, $4)
        RETURNING *;
    `;
    const values = [
        data.employee_id,
        data.required_count,
        data.year,
        data.month
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
};

// Update requirement
const updateSubmissionRequirement = async (employee_id, year, month, required_count) => {
    const query = `
        UPDATE submission_requirements
        SET required_count = $4, updated_at = NOW()
        WHERE employee_id = $1 AND year = $2 AND month = $3
        RETURNING *;
    `;
    const values = [employee_id, year, month, required_count];
    const result = await pool.query(query, values);
    return result.rows[0];
};

// Delete requirement
const deleteSubmissionRequirement = async (employee_id, year, month) => {
    const query = `
        DELETE FROM submission_requirements
        WHERE employee_id = $1 AND year = $2 AND month = $3
        RETURNING *;
    `;
    const values = [employee_id, year, month];
    const result = await pool.query(query, values);
    return result.rows[0];
};

// Sync new employees into the current month
const syncNewEmployees = async () => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Insert missing employees
    const query = `
        INSERT INTO submission_requirements (employee_id, required_count, year, month)
        SELECT e.employee_id,
               COALESCE(prev.required_count, 1) AS required_count,
               $1 AS year,
               $2 AS month
        FROM employees e
        LEFT JOIN submission_requirements sr
            ON sr.employee_id = e.employee_id
           AND sr.year = $1
           AND sr.month = $2
        LEFT JOIN submission_requirements prev
            ON prev.employee_id = e.employee_id
           AND (prev.year = $3 AND prev.month = $4)
        WHERE sr.employee_id IS NULL;
    `;

    // Previous month/year
    let prevMonth = currentMonth - 1;
    let prevYear = currentYear;
    if (prevMonth === 0) {
        prevMonth = 12;
        prevYear -= 1;
    }

    await pool.query(query, [currentYear, currentMonth, prevYear, prevMonth]);
};

module.exports = {
    getAllSubmissionRequirements,
    createSubmissionRequirement,
    updateSubmissionRequirement,
    deleteSubmissionRequirement,
    syncNewEmployees
};
