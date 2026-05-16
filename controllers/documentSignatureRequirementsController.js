const documentSignatureRequirementService = require('../services/documentSignatureRequirementService');
const documentSignatureService = require('../services/documentSignatureService');
const pool = require('../config/db');

const documentSignatureRequirementController = {

  async assignRequirements(req, res) {
    try {
      const {
        documentId,
        documentVersionId,
        employeeIds,
        employee_ids,
        selectedEmployees,
        selectedEmployeeIds
      } = req.body;

      const finalEmployeeIds =
        employeeIds ||
        employee_ids ||
        selectedEmployees ||
        selectedEmployeeIds;

      const assignedBy = req.user?.id || req.user?.employee_id || 'system';

      if (
        !documentId ||
        !documentVersionId ||
        !Array.isArray(finalEmployeeIds) ||
        finalEmployeeIds.length === 0
      ) {
        return res.status(400).json({
          message: 'documentId, documentVersionId, and non-empty employeeIds are required.'
        });
      }

      const created = await documentSignatureRequirementService.assignRequirementsToEmployees({
        documentId,
        documentVersionId,
        employeeIds: finalEmployeeIds,
        assignedBy
      });

      return res.status(201).json(created);
    } catch (error) {
      console.error('Error assigning document signature requirements:', error);
      return res.status(500).json({ message: 'Failed to assign document signature requirements.' });
    }
  },

  async getRequirementsForDocumentVersion(req, res) {
    try {
      const { documentId, versionId } = req.params;
      const requirements = await documentSignatureRequirementService.getRequirementsForDocumentVersion(
        documentId, versionId
      );
      return res.json(requirements);
    } catch (error) {
      console.error('Error fetching document signature requirements:', error);
      return res.status(500).json({ message: 'Failed to fetch document signature requirements.' });
    }
  },

  async getRequirementsForEmployee(req, res) {
    try {
      const { employeeId } = req.params;
      const requirements = await documentSignatureRequirementService.getRequirementsForEmployee(employeeId);
      return res.json(requirements);
    } catch (error) {
      console.error('Error fetching employee document signature requirements:', error);
      return res.status(500).json({ message: 'Failed to fetch employee document signature requirements.' });
    }
  },

  async getDashboardForDocumentVersion(req, res) {
    try {
      const { documentId, versionId } = req.params;

      const requirements = await documentSignatureRequirementService.getRequirementsForDocumentVersion(
        documentId, versionId
      );

      const signatures = await documentSignatureService.getSignaturesForDocumentVersion(
        documentId, versionId
      );

      const employeeIds = requirements.map(r => r.employee_id);

      const { rows: employees } = await pool.query(
        `SELECT employee_id, name, department, job_title, shift, active
         FROM employees
         WHERE employee_id = ANY($1)`,
        [employeeIds]
      );

      const signedEmployeeIds = signatures.map(s => s.employee_id);
      const signed  = employees.filter(e =>  signedEmployeeIds.includes(e.employee_id));
      const missing = employees.filter(e => !signedEmployeeIds.includes(e.employee_id));

      return res.json({
        documentId,
        versionId,
        requiredCount: employees.length,
        signedCount:   signed.length,
        missingCount:  missing.length,
        signed,
        missing
      });
    } catch (error) {
      console.error('Error building signature dashboard:', error);
      return res.status(500).json({ message: 'Failed to build signature dashboard.' });
    }
  }
};

module.exports = documentSignatureRequirementController;