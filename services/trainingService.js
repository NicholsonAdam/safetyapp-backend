const db = require("../config/db");

exports.logAttendance = (employeeId, sessionName) => {
  return db.query(
    `INSERT INTO training_attendance (employee_id, session_name)
     VALUES ($1, $2)
     RETURNING *`,
    [employeeId, sessionName]
  );
};
