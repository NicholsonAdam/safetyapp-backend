const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const PDFDocument = require("pdfkit");

// ─── Multer storage ───────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../../uploads/rack-inspection");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `rack_${Date.now()}${ext}`);
  },
});

const upload = multer({ storage });

// ─── POST /api/forms/rack-inspection ───────────────────────────────
router.post("/", upload.single("photo"), async (req, res) => {
  try {
    const {
      rackId,
      notes,
      submitter,
      ...fields
    } = req.body;

    const photoPath = req.file ? req.file.path : null;

    // ─── Generate PDF ─────────────────────────────────────────────
    const pdfDir = path.join(__dirname, "../../documents/Rack Inspection");
    if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });

    const pdfPath = path.join(
      pdfDir,
      `RackInspection_${rackId}_${Date.now()}.pdf`
    );

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

    stream.on("finish", () => {
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
