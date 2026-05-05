// routes/teamDocuments.js

const express = require('express');
const router = express.Router();

const documentService = require('../services/documentService');
const versionService = require('../services/versionService');
const documentSignatureRequirementService = require('../services/documentSignatureRequirementService');
const documentSignatureService = require('../services/documentSignatureService');
const db = require('../config/db');

// GET /api/team/documents/:employeeId
router.get('/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;

    // 1. Fetch all documents in Public Access (folder_id = 15)
    const { rows: publicDocuments } = await documentService.getDocumentsByFolder(15);

    const results = [];

    for (const doc of publicDocuments) {
      // 2. Get latest version for this document
      const { rows: versions } = await db.query(
        `SELECT *
         FROM document_versions
         WHERE document_id = $1
         ORDER BY version_number DESC
         LIMIT 1`,
        [doc.id]
      );

      const latestVersion = versions[0];
      if (!latestVersion) continue;

      // 3. Check if this employee is required to sign
      const requirement =
        await documentSignatureRequirementService.getRequirementForEmployeeAndDocumentVersion(
          doc.id,
          latestVersion.document_version_id,
          employeeId
        );

      let requiresSignature = false;

      if (requirement) {
        // 4. Check if employee already signed
        const { rows: signatureRows } =
          await db.query(
            `SELECT *
             FROM document_signatures
             WHERE document_id = $1
               AND document_version_id = $2
               AND employee_id = $3
             LIMIT 1`,
            [doc.id, latestVersion.document_version_id, employeeId]
          );

        const signature = signatureRows[0];
        requiresSignature = !signature;
      }

      results.push({
        document_id: doc.id,
        title: doc.title,
        requiresSignature
      });
    }

    return res.json(results);
  } catch (error) {
    console.error('Error fetching team documents:', error);
    return res.status(500).json({ message: 'Failed to fetch team documents.' });
  }
});

module.exports = router;
