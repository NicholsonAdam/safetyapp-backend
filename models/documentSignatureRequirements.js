// documentSignatureRequirements.js

const pool = require('../config/db'); // adjust path if your other models use a different import

const DocumentSignatureRequirements = {
  async createRequirement({ documentId, documentVersionId, employeeId, assignedBy }) {
    const query = `
      INSERT INTO document_signature_requirements
        (document_id, document_version_id, employee_id, assigned_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const values = [documentId, documentVersionId, employeeId, assignedBy];
    const { rows } = await pool.query(query, values);
    return rows[0];
  },

  async getRequirementsForDocumentVersion(documentId, documentVersionId) {
    const query = `
      SELECT *
      FROM document_signature_requirements
      WHERE document_id = $1
        AND document_version_id = $2;
    `;
    const { rows } = await pool.query(query, [documentId, documentVersionId]);
    return rows;
  },

  async getRequirementsForEmployee(employeeId) {
    const query = `
      SELECT *
      FROM document_signature_requirements
      WHERE employee_id = $1;
    `;
    const { rows } = await pool.query(query, [employeeId]);
    return rows;
  },

  async getRequirementForEmployeeAndDocumentVersion(documentId, documentVersionId, employeeId) {
    const query = `
      SELECT *
      FROM document_signature_requirements
      WHERE document_id = $1
        AND document_version_id = $2
        AND employee_id = $3;
    `;
    const { rows } = await pool.query(query, [documentId, documentVersionId, employeeId]);
    return rows[0] || null;
  },

  async deleteRequirementsForDocumentVersion(documentId, documentVersionId) {
    const query = `
      DELETE FROM document_signature_requirements
      WHERE document_id = $1
        AND document_version_id = $2;
    `;
    await pool.query(query, [documentId, documentVersionId]);
  }
};

module.exports = DocumentSignatureRequirements;
