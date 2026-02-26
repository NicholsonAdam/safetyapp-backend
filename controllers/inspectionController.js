const pool = require("../config/db.js");

// CREATE
const createInspection = async (req, res) => {
  try {
    const photoPath = req.file ? req.file.filename : null;
    const f = req.body;

    const values = [
      f.inspector_id,
      f.inspector_name,
      f.date,
      f.department,
      f.area,
      f.shift,
      f.inspector_comments,
      photoPath,

      f.q1, f.q1_corrected,
      f.q2, f.q2_corrected,
      f.q3, f.q3_corrected,
      f.q4, f.q4_corrected,
      f.q5, f.q5_corrected,
      f.q6, f.q6_corrected,
      f.q7, f.q7_corrected,
      f.q8, f.q8_corrected,
      f.q9, f.q9_corrected,
      f.q10, f.q10_corrected
    ];

    const sql = `
      INSERT INTO inspection_checklists (
        inspector_id, inspector_name, date, department, area, shift,
        inspector_comments, photo_path,
        q1, q1_corrected,
        q2, q2_corrected,
        q3, q3_corrected,
        q4, q4_corrected,
        q5, q5_corrected,
        q6, q6_corrected,
        q7, q7_corrected,
        q8, q8_corrected,
        q9, q9_corrected,
        q10, q10_corrected
      )
      VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8,
            $9, $10, $11, $12, $13, $14, $15, $16,
            $17, $18, $19, $20, $21, $22, $23, $24,
            $25, $26, $27, $28
            )
      RETURNING *;
    `;

    const result = await pool.query(sql, values);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error creating inspection:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// GET ALL
const getAllInspections = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM inspection_checklists ORDER BY date DESC;"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching inspections:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// GET ONE
const getInspectionById = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM inspection_checklists WHERE id = $1;",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching inspection:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// UPDATE STATUS
const updateInspectionStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const result = await pool.query(
      "UPDATE inspection_checklists SET status = $1 WHERE id = $2 RETURNING *;",
      [status, req.params.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error updating inspection status:", err);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  createInspection,
  getAllInspections,
  getInspectionById,
  updateInspectionStatus
};