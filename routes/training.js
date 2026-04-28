const router = require("express").Router();
const controller = require("../controllers/trainingController");

router.post("/sessions", controller.createSession);
router.get("/sessions/open", controller.getOpenSessions);
router.post("/sessions/:id/close", controller.closeSession);
router.post("/sessions/:id/scan", controller.logScan);
router.get("/reports", controller.getReports);
router.get("/reports/:id", controller.getReportDetails);

module.exports = router;
