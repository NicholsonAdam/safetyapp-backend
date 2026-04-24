const router = require("express").Router();
const controller = require("../controllers/documentSignaturesController");
const { uploadPhotos } = require("../middleware/upload"); // signature images stored as photos

router.get("/:versionId", controller.getSignatures);
router.post("/", uploadPhotos.single("signature"), controller.createSignature);

module.exports = router;
