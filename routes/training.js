const router = require("express").Router();
const controller = require("../controllers/trainingController");

router.post("/attendance", controller.logAttendance);

module.exports = router;
