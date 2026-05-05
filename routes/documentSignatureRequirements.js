// routes/documentSignatureRequirements.js

const express = require('express');
const router = express.Router();

const documentSignatureRequirementController = require('../controllers/documentSignatureRequirementsController');

// Assign signature requirements
router.post('/', documentSignatureRequirementsController.assignRequirements);

// Get requirements for a document version
router.get(
  '/document/:documentId/version/:versionId',
  documentSignatureRequirementsController.getRequirementsForDocumentVersion
);

// Get requirements for a specific employee
router.get(
  '/employee/:employeeId',
  documentSignatureRequirementsController.getRequirementsForEmployee
);

// Leader dashboard for a document version
router.get(
  '/dashboard/:documentId/:versionId',
  documentSignatureRequirementsController.getDashboardForDocumentVersion
);

module.exports = router;
