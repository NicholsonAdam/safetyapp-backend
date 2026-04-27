const versionService = require("../services/versionService");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

// Detect Office file types
const isOfficeFile = mimetype => {
  if (!mimetype) return false;

  const officeTypes = [
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ];

  return officeTypes.includes(mimetype);
};

// Convert Office → PDF using LibreOffice
const convertToPdf = inputPath => {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(inputPath);
    const cmd = `soffice --headless --convert-to pdf --outdir "${dir}" "${inputPath}"`;

    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error("LibreOffice conversion error:", error);
        console.error("stderr:", stderr);
        return reject(error);
      }

      const baseName = path.basename(inputPath, path.extname(inputPath));
      const pdfPath = path.join(dir, `${baseName}.pdf`);

      fs.access(pdfPath, fs.constants.F_OK, err => {
        if (err) {
          console.error("Converted PDF not found:", pdfPath);
          return reject(new Error("PDF conversion failed"));
        }
        resolve(pdfPath);
      });
    });
  });
};

// ------------------------------
// CONTROLLER FUNCTIONS
// ------------------------------

exports.getVersions = async (req, res) => {
  const result = await versionService.getVersions(req.params.documentId);
  res.json(result.rows);
};

exports.getVersionById = async (req, res) => {
  const result = await versionService.getVersionById(req.params.versionId);
  res.json(result.rows[0]);
};

exports.uploadNewVersion = async (req, res) => {
  try {
    const documentId = req.params.documentId;
    const uploadedBy = req.body.uploaded_by;
    const changeComment = req.body.change_comment;

    let filePath = req.file.path;
    let fileType = req.file.mimetype;

    // Convert Office files to PDF
    if (isOfficeFile(fileType)) {
      console.log("Office file detected, converting to PDF:", filePath);

      const pdfPath = await convertToPdf(filePath);

      filePath = pdfPath;
      fileType = "application/pdf";
    }

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
  } catch (err) {
    console.error("Error uploading new version:", err);
    res.status(500).json({ error: "Failed to upload new version" });
  }
};
