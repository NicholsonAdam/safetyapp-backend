const express = require("express");
const multer = require("multer");
const path = require("path");
const { createSupport } = require("../controllers/supportController");

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "..", "uploads"));
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + file.originalname;
    cb(null, unique);
  }
});

const upload = multer({ storage });

router.post("/create", upload.single("photo"), createSupport);

module.exports = router;