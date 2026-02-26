const pool = require('../config/db');

exports.getDashboardFeed = async (filters = {}) => {
  const {
    assigned_to_employee_id,
    role,
    status,
    area,
    start_date,
    end_date
  } = filters;

  let query = `
    SELECT 
      o.*,
      a.assigned_to_employee_id,
      a.role
    FROM observations o
    JOIN observation_assignments a
      ON o.id = a.observation_id
    WHERE 1=1
  `;

  const values = [];
  let index = 1;

  if (assigned_to_employee_id) {
    query += ` AND a.assigned_to_employee_id = $${index++}`;
    values.push(assigned_to_employee_id);
  }

  if (role) {
    query += ` AND a.role = $${index++}`;
    values.push(role);
  }

  if (status) {
    query += ` AND o.status = $${index++}`;
    values.push(status);
  }

  if (area) {
    query += ` AND o.area = $${index++}`;
    values.push(area);
  }

  if (start_date) {
    query += ` AND o.observation_date >= $${index++}`;
    values.push(start_date);
  }

  if (end_date) {
    query += ` AND o.observation_date <= $${index++}`;
    values.push(end_date);
  }

  query += ` ORDER BY o.created_at DESC`;

  const result = await pool.query(query, values);
  return result.rows;
};