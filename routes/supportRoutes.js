const express = require("express");
const router = express.Router();

const { uploadPhotos } = require("../middleware/upload");
const { createSupport } = require("../controllers/supportController");

router.post("/create", uploadPhotos.single("photo"), createSupport);

module.exports = router;
