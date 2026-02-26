const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // adjust if your db file is elsewhere

// Login using employeeId only
router.post('/login', async (req, res) => {
  try {
    const { employeeId } = req.body;

    if (!employeeId) {
      return res.status(400).json({ message: "Employee ID is required" });
    }

    const result = await pool.query(
      `SELECT * FROM employees 
       WHERE employee_id = $1 
         AND active = true`,
      [employeeId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid or inactive Employee ID" });
    }

    const employee = result.rows[0];

    return res.json({
      message: "Login successful",
      employee: {
        id: employee.employee_id,
        name: employee.name,
        department: employee.department,
        job_title: employee.job_title,
        email: employee.email,
        site_admin: employee.site_admin
      }
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;