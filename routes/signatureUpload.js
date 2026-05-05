const express = require("express");
const router = express.Router();
const { uploadPhotos } = require("../middleware/upload");

router.post("/upload", uploadPhotos.single("signature"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No signature file uploaded." });
  }

  // Return the file path so the frontend can save it
  return res.json({
    filePath: `/uploads/${req.file.filename}`
  });
});

module.exports = router;
