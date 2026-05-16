const pool = require('../config/db');

exports.getSubmissionProgress = async (month, year) => {
  const query = `
    SELECT
      e.employee_id,
      e.name                          AS employee_name,
      l.name                          AS leader_name,
      COALESCE(sr.required_count, 1)  AS required_count,
      COALESCE(sub.actual_submissions, 0) AS actual_submissions
    FROM employees e
    LEFT JOIN employees l
      ON e.leader_id = l.employee_id
    LEFT JOIN submission_requirements sr
      ON sr.employee_id = e.employee_id
      AND sr.month = $1
      AND sr.year  = $2
    LEFT JOIN (
      SELECT observer_id AS employee_id, COUNT(*) AS actual_submissions
      FROM (
        SELECT observer_id, created_at FROM bbs_observations
        UNION ALL
        SELECT observer_id, created_at FROM nearmiss_reports
        UNION ALL
        SELECT inspector_id AS observer_id, created_at FROM inspection_checklists
      ) combined
      WHERE EXTRACT(MONTH FROM created_at) = $1
        AND EXTRACT(YEAR  FROM created_at) = $2
      GROUP BY observer_id
    ) sub
      ON sub.employee_id = e.employee_id
    WHERE e.active = TRUE
    ORDER BY e.employee_id;
  `;

  const result = await pool.query(query, [month, year]);
  return result.rows;
};