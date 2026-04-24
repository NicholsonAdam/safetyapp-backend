const router = require("express").Router();
const controller = require("../controllers/documentsController");

router.get("/", controller.getDocumentsByFolder);
router.get("/:id", controller.getDocumentById);
router.post("/", controller.createDocument);
router.put("/:id", controller.updateDocument);
router.delete("/:id", controller.deleteDocument);

module.exports = router;
