const pool = require('../config/db');
const { fetchAllBBS, insertBBS } = require('../services/bbsService');

// =========================
// GET ALL BBS RECORDS
// =========================
exports.getAllBBS = async (req, res) => {
  try {
    const rows = await fetchAllBBS();
    res.json(rows);
  } catch (err) {
    console.error("Error fetching BBS records:", err);
    res.status(500).json({ message: "Server error fetching BBS records" });
  }
};

// =========================
// CREATE NEW BBS RECORD
// =========================
exports.createBBS = async (req, res) => {
  try {
    const data = req.body;
    const photoFile = req.file || null;

    const newRecord = await insertBBS(data, photoFile);

    res.json({
      message: "BBS Observation submitted successfully",
      record: newRecord
    });

  } catch (err) {
    console.error("Error creating BBS record:", err);
    res.status(500).json({ message: "Server error creating BBS record" });
  }
};

// =========================
// UPDATE STATUS
// =========================
exports.updateBBSStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const result = await pool.query(
      `UPDATE bbs_observations
       SET status = $1
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error updating BBS status:", err);
    res.status(500).json({ message: "Server error updating status" });
  }
};