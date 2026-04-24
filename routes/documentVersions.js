const router = require("express").Router();
const controller = require("../controllers/documentVersionsController");
const { uploadDocuments } = require("../middleware/upload");

router.get("/:documentId", controller.getVersions);
router.get("/:documentId/:versionId", controller.getVersionById);
router.get("/version/:versionId", controller.getVersionById);

router.post(
  "/:documentId",
  uploadDocuments.single("file"),
  controller.uploadNewVersion
);

module.exports = router;
