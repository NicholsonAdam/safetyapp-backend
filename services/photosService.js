const pool = require('../config/db');

exports.savePhotoRecord = async (observationId, filename, url) => {
  const query = `
    INSERT INTO photos (observation_id, filename, url)
    VALUES ($1, $2, $3)
    RETURNING *
  `;

  const values = [observationId, filename, url];

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