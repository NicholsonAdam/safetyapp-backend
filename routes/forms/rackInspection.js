const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const PDFDocument = require("pdfkit");

// ⭐ USE YOUR EXISTING GLOBAL UPLOAD MIDDLEWARE
const { uploadPhotos } = require("../../middleware/upload");

// ⭐ PERSISTENT DISK PATHS
const PDF_DIR = "/data/documents/rack-inspection";

// Ensure PDF directory exists
if (!fs.existsSync(PDF_DIR)) {
  fs.mkdirSync(PDF_DIR, { recursive: true });
}

// ─── POST /api/forms/rack-inspection ───────────────────────────────
router.post("/", uploadPhotos.single("photo"), async (req, res) => {
  try {
    const {
      rackId,
      notes,
      submitter,
      ...fields
    } = req.body;

    // ⭐ Photo saved to persistent disk automatically:
    // /data/uploads/<unique>.jpg
    const photoPath = req.file ? req.file.path : null;

    // ⭐ PDF path on persistent disk
    const pdfPath = path.join(
      PDF_DIR,
      `RackInspection_${rackId}_${Date.now()}.pdf`
    );

    // ─── Generate PDF ─────────────────────────────────────────────
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    doc.fontSize(20).text("Rack Inspection Report", { underline: true });
    doc.moveDown();

    doc.fontSize(12).text(`Rack ID: ${rackId}`);
    doc.text(`Submitter: ${submitter}`);
    doc.text(`Date: ${new Date().toLocaleString()}`);
    doc.moveDown();

    doc.fontSize(14).text("Inspection Results", { underline: true });
    doc.moveDown();

    Object.entries(fields).forEach(([key, value]) => {
      doc.fontSize(12).text(`${key}: ${value}`);
    });

    doc.moveDown();
    doc.fontSize(14).text("Notes", { underline: true });
    doc.fontSize(12).text(notes || "None");

    // ⭐ Add photo page if uploaded
    if (photoPath) {
      doc.addPage();
      doc.fontSize(16).text("Attached Photo");
      doc.moveDown();
      try {
        doc.image(photoPath, { fit: [500, 500], align: "center" });
      } catch (err) {
        doc.text("Photo could not be rendered.");
      }
    }

    doc.end();

    // ─── When PDF is finished writing ─────────────────────────────
    stream.on("finish", async () => {

      // ⭐ Insert Rack Inspection PDF into Document Library
      const pool = require("../../config/db");

      // 1️⃣ Insert into documents table
      const docResult = await pool.query(
        `INSERT INTO documents (folder_id, title, description, created_by, created_at, is_active)
         VALUES ($1, $2, $3, $4, NOW(), true)
         RETURNING id`,
        [
          19, // Rack Inspections folder
          `Rack Inspection - ${rackId}`,
          notes || "",
          submitter
        ]
      );

      const documentId = docResult.rows[0].id;

      // 2️⃣ Insert into document_versions table
      await pool.query(
        `INSERT INTO document_versions (document_id, version_number, file_path, file_type, uploaded_by, uploaded_at, change_comment)
         VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
        [
          documentId,
          1,
          pdfPath,
          "application/pdf",
          submitter,
          "Initial upload"
        ]
      );

      // ⭐ Final response
      return res.json({
        success: true,
        message: "Rack inspection submitted.",
        pdfPath,
        photoPath,
      });
    });

  } catch (err) {
    console.error("Rack Inspection Error:", err);
    res.status(500).json({ success: false, error: "Server error." });
  }
});

module.exports = router;
