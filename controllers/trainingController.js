const db = require("../config/db");

exports.logAttendance = async (req, res) => {
  const { employee_id, session_name } = req.body;

  const result = await db.query(
    `INSERT INTO training_attendance (employee_id, session_name)
     VALUES ($1, $2)
     RETURNING *`,
    [employee_id, session_name]
  );

  res.json(result.rows[0]);
};
