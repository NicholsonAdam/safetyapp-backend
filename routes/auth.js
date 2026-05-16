const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const JWT_SECRET = process.env.JWT_SECRET;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

// ===============================
// LOGIN
// ===============================
router.post("/login", async (req, res) => {
  try {
    const { employeeId, password } = req.body;

    if (!employeeId || !password) {
      return res.status(400).json({ message: "Employee ID and password are required" });
    }

    const result = await pool.query(
      `SELECT employee_id, name, department, job_title, email, site_admin,
              leader_id, active, password_hash, must_change_password,
              failed_attempts, last_failed_attempt
       FROM employees
       WHERE employee_id = $1`,
      [employeeId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const emp = result.rows[0];

    if (!emp.active) {
      return res.status(403).json({ message: "Account is inactive" });
    }

    // Lockout check
    const now = new Date();
    if (emp.failed_attempts >= MAX_ATTEMPTS) {
      const diffMinutes = (now - new Date(emp.last_failed_attempt)) / 1000 / 60;
      if (diffMinutes < LOCKOUT_MINUTES) {
        const remaining = Math.ceil(LOCKOUT_MINUTES - diffMinutes);
        return res.status(403).json({
          message: `Account locked. Try again in ${remaining} minute${remaining === 1 ? "" : "s"}.`
        });
      }
      await pool.query(
        `UPDATE employees SET failed_attempts = 0 WHERE employee_id = $1`,
        [employeeId]
      );
    }

    // Password check
    const match = await bcrypt.compare(password, emp.password_hash);
    if (!match) {
      await pool.query(
        `UPDATE employees
         SET failed_attempts = failed_attempts + 1, last_failed_attempt = NOW()
         WHERE employee_id = $1`,
        [employeeId]
      );
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Reset failed attempts
    await pool.query(
      `UPDATE employees SET failed_attempts = 0, last_failed_attempt = NULL WHERE employee_id = $1`,
      [employeeId]
    );

    // Force password change — no token issued yet
    if (emp.must_change_password) {
      return res.json({
        must_change_password: true,
        employee: {
          employee_id: emp.employee_id,
          name:        emp.name,
          leader_id:   emp.leader_id
        }
      });
    }

    // Issue JWT — 8 hour expiry (a full work shift)
    const token = jwt.sign(
      { employee_id: emp.employee_id, site_admin: emp.site_admin },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    return res.json({
      token,
      employee: {
        employee_id: emp.employee_id,
        name:        emp.name,
        department:  emp.department,
        job_title:   emp.job_title,
        email:       emp.email,
        site_admin:  emp.site_admin,
        leader_id:   emp.leader_id
      }
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ===============================
// CHANGE PASSWORD
// Issues a full token on success so the frontend goes straight to dashboard
// ===============================
router.post("/change-password", async (req, res) => {
  try {
    const { employeeId, newPassword } = req.body;

    if (!employeeId || !newPassword) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (newPassword.length < 10) {
      return res.status(400).json({ message: "Password must be at least 10 characters" });
    }

    const check = await pool.query(
      `SELECT employee_id FROM employees WHERE employee_id = $1`,
      [employeeId]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const hash = await bcrypt.hash(newPassword, 10);

    await pool.query(
      `UPDATE employees
       SET password_hash        = $1,
           must_change_password = FALSE,
           failed_attempts      = 0,
           last_failed_attempt  = NULL
       WHERE employee_id = $2`,
      [hash, employeeId]
    );

    // Fetch full employee record to issue token
    const result = await pool.query(
      `SELECT employee_id, name, department, job_title, email, site_admin, leader_id
       FROM employees WHERE employee_id = $1`,
      [employeeId]
    );
    const emp = result.rows[0];

    const token = jwt.sign(
      { employee_id: emp.employee_id, site_admin: emp.site_admin },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    return res.json({
      message: "Password updated successfully",
      token,
      employee: {
        employee_id: emp.employee_id,
        name:        emp.name,
        department:  emp.department,
        job_title:   emp.job_title,
        email:       emp.email,
        site_admin:  emp.site_admin,
        leader_id:   emp.leader_id
      }
    });

  } catch (err) {
    console.error("Password change error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ===============================
// ADMIN RESET PASSWORD
// ===============================
router.post("/admin/reset-password", async (req, res) => {
  try {
    const { employeeId } = req.body;

    if (!employeeId) {
      return res.status(400).json({ message: "Employee ID required" });
    }

    const tempPassword = "DalMusk123!";
    const hash = await bcrypt.hash(tempPassword, 10);

    await pool.query(
      `UPDATE employees
       SET password_hash        = $1,
           must_change_password = TRUE,
           failed_attempts      = 0,
           last_failed_attempt  = NULL
       WHERE employee_id = $2`,
      [hash, employeeId]
    );

    return res.json({
      message: "Password reset. User must change password on next login.",
      temporary_password: tempPassword
    });

  } catch (err) {
    console.error("Admin reset error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;