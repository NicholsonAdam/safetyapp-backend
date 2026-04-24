console.log("🔥 NearMiss routes LOADED");

const express = require("express");
const router = express.Router();

const { uploadPhotos } = require("../middleware/upload");

const {
  createNearMiss,
  getAllNearMiss,
  getNearMissById,
  updateNearMiss,
  deleteNearMiss,
} = require("../controllers/nearmissController");

// Routes
router.post("/create", uploadPhotos.single("photo"), createNearMiss);
router.get("/all", getAllNearMiss);
router.get("/:id", getNearMissById);
router.put("/update/:id", uploadPhotos.single("photo"), updateNearMiss);
router.delete("/delete/:id", deleteNearMiss);

module.exports = router;
