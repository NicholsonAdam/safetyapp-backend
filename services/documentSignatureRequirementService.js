// documentSignatureRequirementService.js

const DocumentSignatureRequirements = require('../models/documentSignatureRequirements');
const DocumentSignatures = require('./documentSignatureService'); // REQUIRED FIX

const documentSignatureRequirementService = {
  async assignRequirementsToEmployees({ documentId, documentVersionId, employeeIds, assignedBy }) {
    const created = [];

    for (const employeeId of employeeIds) {
      const requirement = await DocumentSignatureRequirements.createRequirement({
        documentId,
        documentVersionId,
        employeeId,
        assignedBy
      });
      created.push(requirement);
    }

    return created;
  },

  async getRequirementsForDocumentVersion(documentId, documentVersionId) {
    return DocumentSignatureRequirements.getRequirementsForDocumentVersion(documentId, documentVersionId);
  },

  async getRequirementsForEmployee(employeeId) {
    return DocumentSignatureRequirements.getRequirementsForEmployee(employeeId);
  },

  async getRequirementForEmployeeAndDocumentVersion(documentId, documentVersionId, employeeId) {
    return DocumentSignatureRequirements.getRequirementForEmployeeAndDocumentVersion(
      documentId,
      documentVersionId,
      employeeId
    );
  },

  async clearRequirementsForDocumentVersion(documentId, documentVersionId) {
    await DocumentSignatureRequirements.deleteRequirementsForDocumentVersion(documentId, documentVersionId);
  },

  // REQUIRED FIX — this method was missing a comma AND missing the import
  async getSignaturesForDocumentVersion(documentId, documentVersionId) {
    return DocumentSignatures.getSignaturesForDocumentVersion(documentId, documentVersionId);
  }
};

module.exports = documentSignatureRequirementService;
