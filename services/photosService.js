const pool = require('../config/db');

exports.savePhotoRecord = async (observationId, url) => {
  const query = `
    INSERT INTO photos (observation_id, url)
    VALUES ($1, $2)
    RETURNING *
  `;

  const values = [observationId, url];

  const result = await pool.query(query, values);

  return result.rows[0];
};

exports.getPhotosForObservation = async (observationId) => {
  const query = `
    SELECT * FROM photos
    WHERE observation_id = $1
    ORDER BY id DESC
  `;

  const result = await pool.query(query, [observationId]);

  return result.rows;
};