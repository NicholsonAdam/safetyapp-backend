// routes/teamDocuments.js

const express = require('express');
const router = express.Router();

const documents = require('./documents');
const documentVersions = require('./documentVersions');
const documentSignatureRequirementService = require('../services/documentSignatureRequirementService');
const documentSignatureService = require('../services/documentSignatureService');

// GET /api/team/documents/:employeeId
router.get('/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;

    // 1. Fetch all documents in Public Access (folder_id = 15)
    const publicDocuments = await documents.getDocumentsByFolderId(15);

    const results = [];

    for (const doc of publicDocuments) {
      // 2. Get latest version
      const latestVersion = await documentVersions.getLatestVersionForDocument(doc.id);

      if (!latestVersion) continue;

      // 3. Check if this employee is required to sign
      const requirement = await documentSignatureRequirementService.getRequirementForEmployeeAndDocumentVersion(
        doc.id,
        latestVersion.id,
        employeeId
      );

      let requiresSignature = false;

      if (requirement) {
        // 4. Check if employee already signed
        const signature = await documentSignatureService.getSignatureForEmployeeAndVersion(
          doc.id,
          latestVersion.id,
          employeeId
        );

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
