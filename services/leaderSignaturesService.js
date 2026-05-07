const db = require("../config/db");

exports.getAllSignatureStatus = (filters) => {
  const {
    employee,
    document,
    status,
    search,
    sort = "assigned_at",
    direction = "desc",
  } = filters;

  const where = [];
  const params = [];
  let idx = 1;

  if (employee) {
    where.push(`(e.name ILIKE $${idx} OR e.employee_id::text ILIKE $${idx})`);
    params.push(`%${employee}%`);
    idx++;
  }

  if (document) {
    where.push(`d.title ILIKE $${idx}`);
    params.push(`%${document}%`);
    idx++;
  }

  if (status) {
    where.push(`(
      CASE 
        WHEN e.active = false THEN 'Inactive'
        WHEN s.id IS NOT NULL THEN 'Signed'
        ELSE 'Pending'
      END = $${idx}
    )`);
    params.push(status);
    idx++;
  }

  if (search) {
    where.push(`(
      e.name ILIKE $${idx}
      OR e.employee_id::text ILIKE $${idx}
      OR d.title ILIKE $${idx}
      OR v.version_number::text ILIKE $${idx}
      OR COALESCE(s.signed_by, '') ILIKE $${idx}
    )`);
    params.push(`%${search}%`);
    idx++;
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const allowedSort = [
    "employee_name",
    "document_title",
    "version_number",
    "status",
    "assigned_at",
    "signed_at",
  ];
  const sortColumn = allowedSort.includes(sort) ? sort : "assigned_at";
  const sortDirection = direction === "asc" ? "asc" : "desc";

  const query = `
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
    ${whereClause}
    ORDER BY ${sortColumn} ${sortDirection}
  `;

  return db.query(query, params);
};
