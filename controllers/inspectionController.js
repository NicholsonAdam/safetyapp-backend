const pool = require("../config/db.js");

// =========================
// CREATE INSPECTION
// =========================
const createInspection = async (req, res) => {
  try {
    const photoPath = req.file ? req.file.filename : null;
    const f = req.body;

    const values = [
      f.inspector_id,          // $1
      f.inspector_name,        // $2
      f.date,                  // $3
      f.department,            // $4
      f.area,                  // $5
      f.shift,                 // $6
      f.inspector_comments,    // $7
      photoPath,               // $8

      f.q1,                    // $9
      f.q1_corrected,          // $10
      f.q2,                    // $11
      f.q2_corrected,          // $12
      f.q3,                    // $13
      f.q3_corrected,          // $14
      f.q4,                    // $15
      f.q4_corrected,          // $16
      f.q5,                    // $17
      f.q5_corrected,          // $18
      f.q6,                    // $19
      f.q6_corrected,          // $20
      f.q7,                    // $21
      f.q7_corrected,          // $22
      f.q8,                    // $23
      f.q8_corrected,          // $24
      f.q9,                    // $25
      f.q9_corrected,          // $26
      f.q10,                   // $27
      f.q10_corrected          // $28
      // created_at is NOW()
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
        q10, q10_corrected,
        created_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8,
        $9, $10,
        $11, $12,
        $13, $14,
        $15, $16,
        $17, $18,
        $19, $20,
        $21, $22,
        $23, $24,
        $25, $26,
        $27, $28,
        NOW()
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

// =========================
// GET ALL
// =========================
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

// =========================
// GET ONE
// =========================
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

// =========================
// UPDATE STATUS
// =========================
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
