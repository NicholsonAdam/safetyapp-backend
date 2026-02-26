const pool = require('../config/db');

exports.getAssignments = async (filters = {}) => {
  const { assigned_to_employee_id, role, observation_id } = filters;

  let query = `SELECT * FROM observation_assignments WHERE 1=1`;
  const values = [];
  let index = 1;

  if (assigned_to_employee_id) {
    query += ` AND assigned_to_employee_id = $${index++}`;
    values.push(assigned_to_employee_id);
  }

  if (role) {
    query += ` AND role = $${index++}`;
    values.push(role);
  }

  if (observation_id) {
    query += ` AND observation_id = $${index++}`;
    values.push(observation_id);
  }

  query += ` ORDER BY created_at DESC`;

  const result = await pool.query(query, values);
  return result.rows;
};