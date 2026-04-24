const db = require("../config/db");

// ------------------------------
// FOLDERS
// ------------------------------

exports.getAllFolders = () => {
  return db.query("SELECT * FROM document_folders ORDER BY name");
};

exports.getFolderById = (id) => {
  return db.query("SELECT * FROM document_folders WHERE id = $1", [id]);
};

exports.createFolder = (name, description, parentId, createdBy) => {
  return db.query(
    `INSERT INTO document_folders (name, description, parent_folder_id, created_by)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [name, description, parentId, createdBy]
  );
};

exports.updateFolder = (id, name, description, parentId) => {
  return db.query(
    `UPDATE document_folders
     SET name=$1, description=$2, parent_folder_id=$3, updated_at=NOW()
     WHERE id=$4 RETURNING *`,
    [name, description, parentId, id]
  );
};

exports.deleteFolder = (id) => {
  return db.query("DELETE FROM document_folders WHERE id=$1", [id]);
};

// ------------------------------
// DOCUMENTS
// ------------------------------

exports.getDocumentsByFolder = (folderId) => {
  return db.query(
    "SELECT * FROM documents WHERE folder_id = $1 ORDER BY title",
    [folderId]
  );
};

exports.getDocumentById = (id) => {
  return db.query("SELECT * FROM documents WHERE id = $1", [id]);
};

exports.createDocument = (folderId, title, description, createdBy) => {
  return db.query(
    `INSERT INTO documents (folder_id, title, description, created_by)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [folderId, title, description, createdBy]
  );
};

exports.updateDocument = (id, title, description, folderId) => {
  return db.query(
    `UPDATE documents
     SET title=$1, description=$2, folder_id=$3, updated_at=NOW()
     WHERE id=$4 RETURNING *`,
    [title, description, folderId, id]
  );
};

exports.deleteDocument = (id) => {
  return db.query("DELETE FROM documents WHERE id=$1", [id]);
};
