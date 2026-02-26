const express = require("express");
const multer = require("multer");
const { createSupport } = require("../controllers/supportController");

const router = express.Router();

const upload = multer({ dest: "uploads/" });

router.post("/create", upload.single("photo"), createSupport);

module.exports = router;