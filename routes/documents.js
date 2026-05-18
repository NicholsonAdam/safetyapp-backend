const router = require("express").Router();
const controller = require("../controllers/documentsController");
const path = require("path");
const fs = require("fs");

// ── GEMBA PDF static serving ──────────────────────────────────────
// Must come before /:id so filenames like "GEMBA_BODY_PREP_2026-05-18T05-22-11.pdf"
// are served as static files instead of being treated as document IDs.
router.get("/:filename", (req, res, next) => {
  if (!req.params.filename.startsWith("GEMBA")) return next();
  const filePath = path.join("/data/documents", req.params.filename);
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  res.status(404).json({ error: "File not found" });
});

router.get("/", controller.getDocumentsByFolder);
router.get("/:id", controller.getDocumentById);
router.post("/", controller.createDocument);
router.put("/:id", controller.updateDocument);
router.delete("/:id", controller.deleteDocument);

module.exports = router;
