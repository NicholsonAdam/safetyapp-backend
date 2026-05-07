const express = require("express");
const router = express.Router();
const db = require("../config/db");

router.get("/history/:employeeId", async (req, res) => {
  const { employeeId } = req.params;

  try {
    const result = await db.query(
      `SELECT 
         ds.signature_id,
         ds.document_id,
         ds.document_version_id,
         ds.employee_id,
         ds.signed_at,
         ds.signature_image_path,
         dv.version_number,
         d.title
       FROM document_signatures ds
       JOIN document_versions dv 
         ON dv.id = ds.document_version_id
       JOIN documents d 
         ON d.id = ds.document_id
       WHERE ds.employee_id = $1
       ORDER BY ds.signed_at DESC`,
      [employeeId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Signature history error:", err);
    res.status(500).json({ message: "Failed to load signature history" });
  }
});

module.exports = router;
