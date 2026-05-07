const db = require("../config/db");

exports.getAllSignatureStatus = () => {
  return db.query(`
    SELECT
      r.id AS requirement_id,
      e.employee_id,
      e.name AS employee_name,
      e.active AS employee_active,
      d.title AS document_title,
      v.version_number,
      r.assigned_at,
      s.signed_at,
      s.signed_by,
      CASE 
        WHEN e.active = false THEN 'Inactive'
        WHEN s.id IS NOT NULL THEN 'Signed'
        ELSE 'Pending'
      END AS status
    FROM document_signature_requirements r
    JOIN employees e ON e.employee_id = r.employee_id
    JOIN documents d ON d.id = r.document_id
    JOIN document_versions v ON v.id = r.document_version_id
    LEFT JOIN document_signatures s
      ON s.document_id = r.document_id
     AND s.document_version_id = r.document_version_id
     AND s.employee_id = r.employee_id
    ORDER BY r.assigned_at DESC
  `);
};
