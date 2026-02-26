// backend/services/observationAssignmentsService.js
const pool = require('../config/db');

exports.assignObservation = async (observationId, assignments) => {
  const query = `
    INSERT INTO observation_assignments (
      observation_id,
      assigned_to_employee_id,
      role
    )
    VALUES ($1, $2, $3)
    RETURNING *
  `;

  const results = [];

  for (const a of assignments) {
    const res = await pool.query(query, [
      observationId,
      a.assigned_to_employee_id,
      a.role
    ]);
    results.push(res.rows[0]);
  }

  return results;
};