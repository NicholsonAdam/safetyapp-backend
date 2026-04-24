const db = require("../config/db");

exports.getSignatures = (versionId) => {
  return db.query(
    "SELECT * FROM document_signatures WHERE document_version_id=$1 ORDER BY signed_at DESC",
    [versionId]
  );
};

exports.createSignature = (
  documentId,
  versionId,
  employeeId,
  signedBy,
  filePath
) => {
  return db.query(
    `INSERT INTO document_signatures 
     (document_id, document_version_id, employee_id, signed_by, signature_image_path)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [documentId, versionId, employeeId, signedBy, filePath]
  );
};
