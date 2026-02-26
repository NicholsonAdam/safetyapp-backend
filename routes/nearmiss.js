console.log("🔥 NearMiss routes LOADED");

const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");

const {
  createNearMiss,
  getAllNearMiss,
  getNearMissById,
  updateNearMiss,
  deleteNearMiss,
} = require("../controllers/nearmissController");

// -----------------------------
// Photo Storage
// -----------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads");
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// -----------------------------
// Routes
// -----------------------------
router.post("/create", upload.single("photo"), createNearMiss);
router.get("/all", getAllNearMiss);
router.get("/:id", getNearMissById);
router.put("/update/:id", upload.single("photo"), updateNearMiss);
router.delete("/delete/:id", deleteNearMiss);

// -----------------------------
module.exports = router;