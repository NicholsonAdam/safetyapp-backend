const DocumentSignatureRequirements = require('../models/documentSignatureRequirements');
const DocumentSignatures = require('./documentSignatureService');
const db = require('../config/db');

const documentSignatureRequirementService = {

  async assignRequirementsToEmployees({ documentId, documentVersionId, employeeIds, assignedBy }) {
    if (!employeeIds.length) return [];

    const values = [];
    const placeholders = employeeIds.map((id, i) => {
      const base = i * 4;
      values.push(documentId, documentVersionId, id, assignedBy);
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
    });

    const query = `
      INSERT INTO document_signature_requirements
        (document_id, document_version_id, employee_id, assigned_by)
      VALUES ${placeholders.join(", ")}
      RETURNING *
    `;

    const { rows } = await db.query(query, values);
    return rows;
  },

  async getRequirementsForDocumentVersion(documentId, documentVersionId) {
    return DocumentSignatureRequirements.getRequirementsForDocumentVersion(documentId, documentVersionId);
  },

  async getRequirementsForEmployee(employeeId) {
    return DocumentSignatureRequirements.getRequirementsForEmployee(employeeId);
  },

  async getRequirementForEmployeeAndDocumentVersion(documentId, documentVersionId, employeeId) {
    return DocumentSignatureRequirements.getRequirementForEmployeeAndDocumentVersion(
      documentId, documentVersionId, employeeId
    );
  },

  async clearRequirementsForDocumentVersion(documentId, documentVersionId) {
    await DocumentSignatureRequirements.deleteRequirementsForDocumentVersion(documentId, documentVersionId);
  },

  async getSignaturesForDocumentVersion(documentId, documentVersionId) {
    return DocumentSignatures.getSignaturesForDocumentVersion(documentId, documentVersionId);
  }
};

module.exports = documentSignatureRequirementService;