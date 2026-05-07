const service = require("../services/leaderSignaturesService");

exports.getAll = async (req, res) => {
  try {
    const result = await service.getAllSignatureStatus(req.query);
    res.json(result.rows);
  } catch (err) {
    console.error("Error loading leader signatures:", err);
    res.status(500).json({ message: "Failed to load signature dashboard." });
  }
};

exports.exportExcel = async (req, res) => {
  try {
    const result = await service.getAllSignatureStatus(req.query);
    const rows = result.rows;

    let csv = "Employee ID,Employee Name,Active,Document,Version,Status,Assigned At,Signed At,Signed By\n";

    for (const r of rows) {
      const line = [
        r.employee_id,
        `"${(r.employee_name || "").replace(/"/g, '""')}"`,
        r.employee_active ? "Yes" : "No",
        `"${(r.document_title || "").replace(/"/g, '""')}"`,
        r.version_number,
        r.status,
        r.assigned_at ? new Date(r.assigned_at).toISOString() : "",
        r.signed_at ? new Date(r.signed_at).toISOString() : "",
        `"${(r.signed_by || "").replace(/"/g, '""')}"`,
      ].join(",");

      csv += line + "\n";
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=\"leader_signatures_export.csv\""
    );
    res.send(csv);
  } catch (err) {
    console.error("Error exporting leader signatures:", err);
    res.status(500).json({ message: "Failed to export signature dashboard." });
  }
};
