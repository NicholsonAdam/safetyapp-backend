const pool = require('../config/db');

// Helper to get submission counts from a table
async function countSubmissions(table, employeeField, employeeId, month, year) {
  const query = `
    SELECT COUNT(*) AS count
    FROM ${table}
    WHERE ${employeeField} = $1
      AND EXTRACT(MONTH FROM created_at) = $2
      AND EXTRACT(YEAR FROM created_at) = $3;
  `;
  const result = await pool.query(query, [employeeId, month, year]);
  return Number(result.rows[0].count || 0);
}

exports.getSubmissionProgress = async (month, year) => {
  // 1. Get all employees + required counts
  const baseQuery = `
    SELECT 
      e.employee_id,
      e.employee_name,
      l.employee_name AS leader_name,
      sr.required_count
    FROM employees e
    LEFT JOIN employees l ON e.leader_id = l.employee_id
    LEFT JOIN submission_requirements sr 
      ON sr.employee_id = e.employee_id 
      AND sr.month = $1 
      AND sr.year = $2
    ORDER BY e.employee_id;
  `;

  const baseResult = await pool.query(baseQuery, [month, year]);
  const rows = baseResult.rows;

  // 2. For each employee, count submissions
  for (const r of rows) {
    const id = r.employee_id;

    const bbs = await countSubmissions("bbs_observations", "observer_id", id, month, year);
    const nm  = await countSubmissions("nearmiss_reports", "observer_id", id, month, year);
    const ins = await countSubmissions("inspection_checklists", "observer_id", id, month, year);

    r.actual_submissions = bbs + nm + ins;
  }

  return rows;
};
