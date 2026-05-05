// routes/teamDocuments.js

const express = require('express');
const router = express.Router();

const documentSignatureRequirementService = require('../services/documentSignatureRequirementService');
const db = require('../config/db');

// Safe recursive folder lookup
async function getAllSubfolderIds(parentId) {
  try {
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
  } catch (err) {
    console.error("Folder recursion error:", err);
    return [];
  }
}

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

      // 5. Push ONLY the latest version
      results.push({
        document_id: doc.id,
        document_version_id: latestVersion.document_version_id,
        version_number: latestVersion.version_number,
        title: doc.title,
        requiresSignature
      });
    }

    // 6. Deduplicate by document_id (just in case)
    const unique = Object.values(
      results.reduce((acc, item) => {
        acc[item.document_id] = item;
        return acc;
      }, {})
    );

    return res.json(unique);
  } catch (error) {
    console.error('Error fetching team documents:', error);
    return res.json([]);
  }
});

module.exports = router;
