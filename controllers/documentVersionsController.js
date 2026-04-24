const versionService = require("../services/versionService");

exports.getVersions = async (req, res) => {
  const result = await versionService.getVersions(req.params.documentId);
  res.json(result.rows);
};

exports.getVersionById = async (req, res) => {
  const result = await versionService.getVersionById(req.params.versionId);
  res.json(result.rows[0]);
};

exports.uploadNewVersion = async (req, res) => {
  const documentId = req.params.documentId;
  const uploadedBy = req.body.uploaded_by;
  const changeComment = req.body.change_comment;
  const filePath = req.file.path;
  const fileType = req.file.mimetype;

  const nextVersion = await versionService.getNextVersionNumber(documentId);

  const result = await versionService.insertVersion(
    documentId,
    nextVersion,
    filePath,
    fileType,
    uploadedBy,
    changeComment
  );

  res.json(result.rows[0]);
};
