const pool = require('../config/db');

module.exports = {
  createObservation: async (obs) => {
    const {
      observer_id,
      observed_id,
      area,
      observation_date,
      observation_time,
      ppe_ok,
      proper_position_ok,
      tools_equipment_ok,
      unsafe_conditions,
      observer_comments,
      observed_feedback,
      observed_recent_safety_actions
    } = obs;

    const result = await pool.query(
      `INSERT INTO observations (
        observer_id, observed_id, area, observation_date, observation_time,
        ppe_ok, proper_position_ok, tools_equipment_ok,
        unsafe_conditions, observer_comments, observed_feedback,
        observed_recent_safety_actions
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *`,
      [
        observer_id,
        observed_id,
        area,
        observation_date,
        observation_time,
        ppe_ok,
        proper_position_ok,
        tools_equipment_ok,
        unsafe_conditions,
        observer_comments,
        observed_feedback,
        observed_recent_safety_actions
      ]
    );

    return result.rows[0];
  },

  getObservationById: async (id) => {
    const result = await pool.query(
      'SELECT * FROM observations WHERE id = $1',
      [id]
    );
    return result.rows[0];
  },

  getObservationsForEmployee: async (employeeId) => {
    const result = await pool.query(
      'SELECT * FROM observations WHERE observed_id = $1 ORDER BY created_at DESC',
      [employeeId]
    );
    return result.rows;
  }
};