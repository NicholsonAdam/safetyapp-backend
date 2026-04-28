const router = require("express").Router();
const controller = require("../controllers/trainingController");

router.post("/sessions", controller.createSession);
router.get("/sessions/open", controller.getOpenSessions);
router.post("/sessions/:id/close", controller.closeSession);
router.post("/sessions/:id/scan", controller.logScan);

module.exports = router;
