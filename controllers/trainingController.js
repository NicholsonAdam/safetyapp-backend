const db = require("../config/db");

// CREATE A NEW ATTENDANCE SESSION
exports.createSession = async (req, res) => {
  const { name, type, training_title, trainer_name } = req.body;
  const created_by = Number(req.headers["employee_id"]);

  const result = await db.query(
    `INSERT INTO attendance_sessions (name, type, training_title, trainer_name, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [name, type, training_title || null, trainer_name || null, created_by]
  );

  res.json(result.rows[0]);
};

// GET ALL OPEN SESSIONS
exports.getOpenSessions = async (req, res) => {
  const result = await db.query(
    `SELECT *
     FROM attendance_sessions
     WHERE closed_at IS NULL
     ORDER BY created_at DESC`
  );

  res.json(result.rows);
};

// CLOSE A SESSION AND PREPARE REPORT ENTRY
exports.closeSession = async (req, res) => {
  const sessionId = req.params.id;

  // Close the session
  const session = await db.query(
    `UPDATE attendance_sessions
     SET closed_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [sessionId]
  );

  const s = session.rows[0];

  // Convert timestamp string → Date object
  const createdAt = new Date(s.created_at);

  // Build report title
  let title = "";
  let meeting_month = null;

  if (s.type === "PLANT_MEETING") {
    const monthName = createdAt.toLocaleString("en-US", { month: "long" });
    const year = createdAt.getFullYear();

    title = `${monthName} Plant Meeting ${year}`;
    meeting_month = `${year}-${String(createdAt.getMonth() + 1).padStart(2, "0")}-01`;

  } else {
    const dateStr = createdAt.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric"
    });

    title = `${s.training_title} - ${dateStr}`;
  }

  // Insert report record
  const report = await db.query(
    `INSERT INTO attendance_reports (type, title, attendance_session_id, meeting_month)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [s.type, title, s.id, meeting_month]
  );

  res.json({
    session: s,
    report: report.rows[0]
  });
};

// LOG A SCAN INTO AN ACTIVE SESSION
exports.logScan = async (req, res) => {
  const { attendance_session_id, employee_id, source } = req.body;

  const scanned_by = Number(req.headers["employee_id"]) || employee_id;

  const result = await db.query(
    `INSERT INTO attendance_scans (attendance_session_id, employee_id, scanned_by, source)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [attendance_session_id, employee_id, scanned_by, source]
  );

  res.json(result.rows[0]);
};
