// routes/teamDocuments.js

const express = require('express');
const router = express.Router();

const documentSignatureRequirementService = require('../services/documentSignatureRequirementService');
const db = require('../config/db');

// 🔥 Correct recursive folder lookup using PostgreSQL CTE
async function getAllSubfolderIds(rootId) {
  try {
    const result = await db.query(
      `
      WITH RECURSIVE subfolders AS (
        SELECT id
        FROM document_folders
        WHERE id = $1

        UNION ALL

        SELECT df.id
        FROM document_folders df
        INNER JOIN subfolders sf ON df.parent_folder_id = sf.id
      )
      SELECT id FROM subfolders;
      `,
      [rootId]
    );

    return result.rows.map(r => r.id);
  } catch (err) {
    console.error("Folder recursion error:", err);
    return [];
  }
}

router.get('/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;

    // 1. Get ALL subfolders under Public Access (folder_id = 15)
    const folderIds = await getAllSubfolderIds(15); // already includes 15

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
          latestVersion.id,
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
          [doc.id, latestVersion.id, employeeId]
        );

        requiresSignature = !signatureRows[0];
      }

      // 5. Push ONLY the latest version
      results.push({
        document_id: doc.id,
        document_version_id: latestVersion.id,
        version_number: latestVersion.version_number,
        title: doc.title,
        file_path: latestVersion.file_path,
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
