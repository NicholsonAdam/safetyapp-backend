const db = require("../config/db");

exports.createSession = async (req, res) => {
  try {
    const { name, type, training_title, trainer_name } = req.body;
    const created_by = Number(req.headers["employee_id"]);

    const result = await db.query(
      `INSERT INTO attendance_sessions (name, type, training_title, trainer_name, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, type, training_title || null, trainer_name || null, created_by]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error creating session:", err);
    res.status(500).json({ error: "Failed to create session" });
  }
};

exports.getOpenSessions = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM attendance_sessions WHERE closed_at IS NULL ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching sessions:", err);
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
};

exports.closeSession = async (req, res) => {
  try {
    const sessionId = req.params.id;

    const session = await db.query(
      `UPDATE attendance_sessions SET closed_at = NOW() WHERE id = $1 RETURNING *`,
      [sessionId]
    );

    const s = session.rows[0];
    const createdAt = new Date(s.created_at);

    let title = "";
    let meeting_month = null;

    if (s.type === "PLANT_MEETING") {
      const monthName = createdAt.toLocaleString("en-US", { month: "long" });
      const year = createdAt.getFullYear();
      title = `${monthName} Plant Meeting ${year}`;
      meeting_month = `${year}-${String(createdAt.getMonth() + 1).padStart(2, "0")}-01`;
    } else {
      const dateStr = createdAt.toLocaleDateString("en-US", {
        month: "long", day: "numeric", year: "numeric"
      });
      title = `${s.training_title} - ${dateStr}`;
    }

    const report = await db.query(
      `INSERT INTO attendance_reports (type, title, attendance_session_id, meeting_month)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [s.type, title, s.id, meeting_month]
    );

    res.json({ session: s, report: report.rows[0] });
  } catch (err) {
    console.error("Error closing session:", err);
    res.status(500).json({ error: "Failed to close session" });
  }
};

exports.logScan = async (req, res) => {
  try {
    const { attendance_session_id, employee_id, source } = req.body;
    const scanned_by = Number(req.headers["employee_id"]) || employee_id;

    const result = await db.query(
      `INSERT INTO attendance_scans (attendance_session_id, employee_id, scanned_at, scanned_by, source)
       VALUES ($1, $2, NOW(), $3, $4)
       RETURNING *`,
      [attendance_session_id, employee_id, scanned_by, source]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error logging scan:", err);
    res.status(500).json({ error: "Failed to log scan" });
  }
};

exports.getReports = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM attendance_reports ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching reports:", err);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
};

exports.getReportDetails = async (req, res) => {
  try {
    const reportId = req.params.id;

    const report = await db.query(
      `SELECT * FROM attendance_reports WHERE id = $1`, [reportId]
    );

    if (report.rows.length === 0) {
      return res.status(404).json({ error: "Report not found" });
    }

    const r = report.rows[0];

    if (r.type === "PLANT_MEETING") {
      const employees = await db.query(
        `SELECT employee_id, name FROM employees WHERE active = true ORDER BY employee_id`
      );
      const scans = await db.query(
        `SELECT employee_id FROM attendance_scans WHERE attendance_session_id = $1`,
        [r.attendance_session_id]
      );

      const scannedSet = new Set(scans.rows.map(s => s.employee_id));
      const rows = employees.rows.map(emp => ({
        employee_id: emp.employee_id,
        name: emp.name,
        attended: scannedSet.has(emp.employee_id)
      }));

      return res.json({ report: r, rows });
    }

    const scans = await db.query(
      `SELECT s.employee_id, s.scanned_at, e.name
       FROM attendance_scans s
       LEFT JOIN employees e ON e.employee_id = s.employee_id
       WHERE s.attendance_session_id = $1
       ORDER BY s.scanned_at`,
      [r.attendance_session_id]
    );

    const rows = scans.rows.map(row => ({
      employee_id: row.employee_id,
      name: row.name || "",
      scanned_at: row.scanned_at
    }));

    res.json({ report: r, rows });
  } catch (err) {
    console.error("Error fetching report details:", err);
    res.status(500).json({ error: "Failed to fetch report details" });
  }
};