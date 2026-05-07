const router = require("express").Router();
const controller = require("../controllers/leaderSignaturesController");

router.get("/", controller.getAll);
router.get("/export/excel", controller.exportExcel);

module.exports = router;
