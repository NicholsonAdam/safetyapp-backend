const router = require("express").Router();
const controller = require("../controllers/documentVersionsController");
const { uploadDocuments } = require("../middleware/upload");

// Specific routes FIRST
router.get("/version/:versionId", controller.getVersionById);

// Versions for a document
router.get("/:documentId", controller.getVersions);

// Upload new version
router.post(
  "/:documentId",
  uploadDocuments.single("file"),
  controller.uploadNewVersion
);

module.exports = router;
