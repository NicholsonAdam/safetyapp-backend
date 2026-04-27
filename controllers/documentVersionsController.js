const service = require("../services/documentService");

exports.getAllFolders = async (req, res) => {
  const result = await service.getAllFolders();
  res.json(result.rows);
};

exports.getFolderById = async (req, res) => {
  const result = await service.getFolderById(req.params.id);
  res.json(result.rows[0]);
};

exports.createFolder = async (req, res) => {
  const { name, description, parent_folder_id, created_by } = req.body;

  const result = await service.createFolder(
    name,
    description,
    parent_folder_id,
    created_by
  );

  res.json(result.rows[0]);
};

exports.updateFolder = async (req, res) => {
  const { name, description, parent_folder_id } = req.body;

  const result = await service.updateFolder(
    req.params.id,
    name,
    description,
    parent_folder_id
  );

  res.json(result.rows[0]);
};

exports.deleteFolder = async (req, res) => {
  await service.deleteFolder(req.params.id);
  res.json({ success: true });
};
