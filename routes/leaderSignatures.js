const router = require("express").Router();
const controller = require("../controllers/leaderSignaturesController");

router.get("/", controller.getAll);

module.exports = router;
