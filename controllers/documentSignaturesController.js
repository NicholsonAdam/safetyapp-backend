const service = require("../services/documentSignaturesService");

exports.getSignatures = async (req, res) => {
  const result = await service.getSignatures(req.params.versionId);
  res.json(result.rows);
};

exports.createSignature = async (req, res) => {
  const { document_id, document_version_id, employee_id, signed_by } = req.body;

  const filePath = req.file.path;

  const result = await service.createSignature(
    document_id,
    document_version_id,
    employee_id,
    signed_by,
    filePath
  );

  res.json(result.rows[0]);
};
