const pool = require('../config/db'); // adjust if your db file is in a different location

async function getPhotoById(id) {
  const result = await pool.query(
    'SELECT * FROM photos WHERE id = $1',
    [id]
  );
  return result.rows[0];
}

async function deletePhotoById(id) {
  await pool.query(
    'DELETE FROM photos WHERE id = $1',
    [id]
  );
}

module.exports = {
  getPhotoById,
  deletePhotoById
};