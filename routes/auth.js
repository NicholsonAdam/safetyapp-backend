// backend/routes/auth.js

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

        // Pull employee record
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

        // Enforce active flag
        if (!emp.active) {
            return res.status(403).json({ message: "Account is inactive" });
        }

        // Lockout logic
        const now = new Date();
        if (emp.failed_attempts >= MAX_ATTEMPTS) {
            const last = new Date(emp.last_failed_attempt);
            const diffMinutes = (now - last) / 1000 / 60;

            if (diffMinutes < LOCKOUT_MINUTES) {
                return res.status(403).json({
                    message: "Too many failed attempts. Try again later."
                });
            } else {
                // Reset attempts after cooldown
                await pool.query(
                    `UPDATE employees SET failed_attempts = 0 WHERE employee_id = $1`,
                    [employeeId]
                );
            }
        }

        // Validate password
        const match = await bcrypt.compare(password, emp.password_hash);
        if (!match) {
            await pool.query(
                `UPDATE employees
                 SET failed_attempts = failed_attempts + 1,
                     last_failed_attempt = NOW()
                 WHERE employee_id = $1`,
                [employeeId]
            );

            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Reset failed attempts on success
        await pool.query(
            `UPDATE employees SET failed_attempts = 0 WHERE employee_id = $1`,
            [employeeId]
        );

        // Force password change?
        if (emp.must_change_password) {
            return res.json({
                must_change_password: true,
                employee: {
                    employee_id: emp.employee_id,
                    name: emp.name,
                    leader_id: emp.leader_id
                }
            });
        }

        // Issue JWT
        const token = jwt.sign(
            {
                employee_id: emp.employee_id,
                site_admin: emp.site_admin
            },
            JWT_SECRET,
            { expiresIn: "30m" }
        );

        return res.json({
            token,
            employee: {
                employee_id: emp.employee_id,
                name: emp.name,
                department: emp.department,
                job_title: emp.job_title,
                email: emp.email,
                site_admin: emp.site_admin,
                leader_id: emp.leader_id
            }
        });

    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// ===============================
// CHANGE PASSWORD (USER)
// ===============================
router.post("/change-password", async (req, res) => {
    try {
        const { employeeId, newPassword } = req.body;

        if (!employeeId || !newPassword) {
            return res.status(400).json({ message: "Missing fields" });
        }

        const hash = await bcrypt.hash(newPassword, 10);

        await pool.query(
            `UPDATE employees
             SET password_hash = $1,
                 must_change_password = FALSE,
                 failed_attempts = 0,
                 last_failed_attempt = NULL
             WHERE employee_id = $2`,
            [hash, employeeId]
        );

        return res.json({ message: "Password updated successfully" });

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
             SET password_hash = $1,
                 must_change_password = TRUE,
                 failed_attempts = 0,
                 last_failed_attempt = NULL
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