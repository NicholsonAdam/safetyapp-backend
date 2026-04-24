const router = require("express").Router();
const controller = require("../controllers/documentFoldersController");

router.get("/", controller.getAllFolders);
router.get("/:id", controller.getFolderById);
router.post("/", controller.createFolder);
router.put("/:id", controller.updateFolder);
router.delete("/:id", controller.deleteFolder);

module.exports = router;
