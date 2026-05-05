// routes/documentSignatureRequirements.js

const express = require('express');
const router = express.Router();

const documentSignatureRequirementController = require('../controllers/documentSignatureRequirementsController');

// Assign signature requirements
router.post('/', documentSignatureRequirementController.assignRequirements);

// Get requirements for a document version
router.get(
  '/document/:documentId/version/:versionId',
  documentSignatureRequirementController.getRequirementsForDocumentVersion
);

// Get requirements for a specific employee
router.get(
  '/employee/:employeeId',
  documentSignatureRequirementController.getRequirementsForEmployee
);

// Leader dashboard for a document version
router.get(
  '/dashboard/:documentId/:versionId',
  documentSignatureRequirementController.getDashboardForDocumentVersion
);

module.exports = router;
