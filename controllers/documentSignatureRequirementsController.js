// documentSignatureRequirementController.js

const documentSignatureRequirementService = require('../services/documentSignatureRequirementService');
const documentSignatureService = require('../services/documentSignatureService');
const pool = require('../config/db');

const documentSignatureRequirementController = {
  // POST /api/document-signature-requirements
  async assignRequirements(req, res) {
    try {
      console.log("RAW REQ BODY:", req.body);

      const {
        documentId,
        documentVersionId,
        employeeIds,
        employee_ids,
        selectedEmployees,
        selectedEmployeeIds
      } = req.body;

      // Normalize all possible frontend field names
      const finalEmployeeIds =
        employeeIds ||
        employee_ids ||
        selectedEmployees ||
        selectedEmployeeIds;

      console.log("FINAL EMPLOYEE IDS:", finalEmployeeIds);

      const assignedBy = req.user?.id || req.user?.employee_id || 'system';

      if (
        !documentId ||
        !documentVersionId ||
        !Array.isArray(finalEmployeeIds) ||
        finalEmployeeIds.length === 0
      ) {
        return res.status(400).json({
          message:
            'documentId, documentVersionId, and non-empty employeeIds are required.'
        });
      }

      const created =
        await documentSignatureRequirementService.assignRequirementsToEmployees({
          documentId,
          documentVersionId,
          employeeIds: finalEmployeeIds,
          assignedBy
        });

      return res.status(201).json(created);
    } catch (error) {
      console.error('Error assigning document signature requirements:', error);
      return res
        .status(500)
        .json({ message: 'Failed to assign document signature requirements.' });
    }
  },

  // GET /api/document-signature-requirements/document/:documentId/version/:versionId
  async getRequirementsForDocumentVersion(req, res) {
    try {
      const { documentId, versionId } = req.params;

      const requirements =
        await documentSignatureRequirementService.getRequirementsForDocumentVersion(
          documentId,
          versionId
        );

      return res.json(requirements);
    } catch (error) {
      console.error('Error fetching document signature requirements:', error);
      return res
        .status(500)
        .json({ message: 'Failed to fetch document signature requirements.' });
    }
  },

  // GET /api/document-signature-requirements/employee/:employeeId
  async getRequirementsForEmployee(req, res) {
    try {
      const { employeeId } = req.params;

      const requirements =
        await documentSignatureRequirementService.getRequirementsForEmployee(
          employeeId
        );

      return res.json(requirements);
    } catch (error) {
      console.error('Error fetching employee document signature requirements:', error);
      return res
        .status(500)
        .json({ message: 'Failed to fetch employee document signature requirements.' });
    }
  },

  // GET /api/document-signature-requirements/dashboard/:documentId/:versionId
  async getDashboardForDocumentVersion(req, res) {
    try {
      const { documentId, versionId } = req.params;

      // 1. Get all requirements for this version
      const requirements =
        await documentSignatureRequirementService.getRequirementsForDocumentVersion(
          documentId,
          versionId
        );

      // 2. Get all signatures for this version
      const signatures =
        await documentSignatureService.getSignaturesForDocumentVersion(
          documentId,
          versionId
        );

      // 3. Get employee details
      const employeeIds = requirements.map(r => r.employee_id);

      const { rows: employees } = await pool.query(
        `SELECT employee_id, name, department, job_title, shift, active
         FROM employees
         WHERE employee_id = ANY($1)`,
        [employeeIds]
      );

      // 4. Build dashboard lists
      const signedEmployeeIds = signatures.map(s => s.employee_id);

      const signed = employees.filter(e =>
        signedEmployeeIds.includes(e.employee_id)
      );
      const missing = employees.filter(
        e => !signedEmployeeIds.includes(e.employee_id)
      );

      return res.json({
        documentId,
        versionId,
        requiredCount: employees.length,
        signedCount: signed.length,
        missingCount: missing.length,
        signed,
        missing
      });
    } catch (error) {
      console.error('Error building signature dashboard:', error);
      return res
        .status(500)
        .json({ message: 'Failed to build signature dashboard.' });
    }
  }
};

module.exports = documentSignatureRequirementController;
