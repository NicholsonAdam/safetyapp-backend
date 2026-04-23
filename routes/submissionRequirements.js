const express = require('express');
const router = express.Router();
const controller = require('../controllers/submissionRequirementsController');
const progressController = require('../controllers/submissionRequirementsProgressController');

router.get('/', controller.getAll);
router.post('/', controller.create);
router.put('/', controller.update);
router.delete('/', controller.remove);
router.get('/progress', progressController.getProgress);

module.exports = router;
