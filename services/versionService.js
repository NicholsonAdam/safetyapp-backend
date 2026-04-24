const db = require("../config/db");

// Get all versions for a document
exports.getVersions = (documentId) => {
  return db.query(
    "SELECT * FROM document_versions WHERE document_id=$1 ORDER BY version_number DESC",
    [documentId]
  );
};

// Get a single version
exports.getVersionById = (versionId) => {
  return db.query(
    "SELECT * FROM document_versions WHERE id=$1",
    [versionId]
  );
};

// Get next version number
exports.getNextVersionNumber = async (documentId) => {
  const result = await db.query(
    "SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version FROM document_versions WHERE document_id=$1",
    [documentId]
  );
  return result.rows[0].next_version;
};

// Insert new version
exports.insertVersion = (documentId, versionNumber, filePath, fileType, uploadedBy, comment) => {
  return db.query(
    `INSERT INTO document_versions 
     (document_id, version_number, file_path, file_type, uploaded_by, change_comment)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [documentId, versionNumber, filePath, fileType, uploadedBy, comment]
  );
};
