const express = require('express');
const router = express.Router();
const controller = require('../controllers/submissionRequirementsController');

router.get('/', controller.getAll);
router.post('/', controller.create);
router.put('/', controller.update);
router.delete('/', controller.remove);

module.exports = router;
