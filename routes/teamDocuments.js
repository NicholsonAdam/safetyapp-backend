// routes/teamDocuments.js

const express = require('express');
const router = express.Router();

const documentSignatureRequirementService = require('../services/documentSignatureRequirementService');
const db = require('../config/db');

// Helper: recursively get all subfolder IDs under a parent folder
async function getAllSubfolderIds(parentId) {
  const result = await db.query(
    `SELECT id FROM document_folders WHERE parent_id = $1`,
    [parentId]
  );

  const ids = result.rows.map(r => r.id);
  let all = [...ids];

  for (const id of ids) {
    const children = await getAllSubfolderIds(id);
    all = [...all, ...children];
  }

  return all;
}

// GET /api/team/documents/:employeeId
router.get('/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;

    // 1. Get ALL subfolders under Public Access (folder_id = 15)
    const subfolders = await getAllSubfolderIds(15);
    const folderIds = [15, ...subfolders];

    // 2. Fetch all documents in ANY of those folders
    const { rows: docs } = await db.query(
      `SELECT * FROM documents WHERE folder_id = ANY($1)`,
      [folderIds]
    );

    const results = [];

    for (const doc of docs) {
      // 3. Get ONLY the latest version
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

      // 4. Check if this employee is required to sign
      const requirement =
        await documentSignatureRequirementService.getRequirementForEmployeeAndDocumentVersion(
          doc.id,
          latestVersion.document_version_id,
          employeeId
        );

      let requiresSignature = false;

      if (requirement) {
        // 5. Check if employee already signed
        const { rows: signatureRows } = await db.query(
          `SELECT *
           FROM document_signatures
           WHERE document_id = $1
             AND document_version_id = $2
             AND employee_id = $3
           LIMIT 1`,
          [doc.id, latestVersion.document_version_id, employeeId]
        );

        requiresSignature = !signatureRows[0];
      }

      results.push({
        document_id: doc.id,
        document_version_id: latestVersion.document_version_id,
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
