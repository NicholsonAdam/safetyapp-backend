const express = require("express");
const multer = require("multer");
const path = require("path");
const { createSupport } = require("../controllers/supportController");

const router = express.Router();

const upload = require("../middleware/upload");

router.post("/create", upload.single("photo"), createSupport);

module.exports = router;