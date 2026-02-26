const pool = require('../config/db');

exports.getEmployeeById = async (employeeId) => {
  const result = await pool.query(
    `SELECT employee_id, email 
     FROM employees 
     WHERE employee_id = $1`,
    [employeeId]
  );

  return result.rows[0] || null;
};