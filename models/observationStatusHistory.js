const pool = require('../config/db');

exports.logStatusChange = async (observationId, oldStatus, newStatus, changedBy) => {
  const query = `
    INSERT INTO observation_status_history (
      observation_id,
      old_status,
      new_status,
      changed_by
    )
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `;

  const values = [observationId, oldStatus, newStatus, changedBy];

  const result = await pool.query(query, values);
  return result.rows[0];
};