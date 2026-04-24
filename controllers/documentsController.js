const service = require("../services/documentService");

exports.getDocumentsByFolder = async (req, res) => {
  const result = await service.getDocumentsByFolder(req.query.folder_id);
  res.json(result.rows);
};

exports.getDocumentById = async (req, res) => {
  const result = await service.getDocumentById(req.params.id);
  res.json(result.rows[0]);
};

exports.createDocument = async (req, res) => {
  const { folder_id, title, description, created_by } = req.body;

  const result = await service.createDocument(
    folder_id,
    title,
    description,
    created_by
  );

  res.json(result.rows[0]);
};

exports.updateDocument = async (req, res) => {
  const { title, description, folder_id } = req.body;

  const result = await service.updateDocument(
    req.params.id,
    title,
    description,
    folder_id
  );

  res.json(result.rows[0]);
};

exports.deleteDocument = async (req, res) => {
  await service.deleteDocument(req.params.id);
  res.json({ success: true });
};
