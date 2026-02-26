const express = require("express");
const router = express.Router();
const ExcelJS = require("exceljs");
const pool = require("../config/db"); // adjust if your db file is in /config/db

// EXPORT EMPLOYEES TO EXCEL
router.get("/export", async (req, res) => {
  try {
    // 1. Query all employees
    const result = await pool.query(`
      SELECT 
        employee_id,
        name,
        department,
        job_title,
        shift,
        leader_id,
        email,
        site_admin,
        active
      FROM employees
      ORDER BY employee_id ASC
    `);

    const employees = result.rows;

    // 2. Create workbook + worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Employees");

    // 3. Add header row
    worksheet.columns = [
      { header: "Employee ID", key: "employee_id", width: 15 },
      { header: "Name", key: "name", width: 25 },
      { header: "Department", key: "department", width: 20 },
      { header: "Job Title", key: "job_title", width: 25 },
      { header: "Shift", key: "shift", width: 10 },
      { header: "Leader ID", key: "leader_id", width: 15 },
      { header: "Email", key: "email", width: 30 },
      { header: "Site Admin", key: "site_admin", width: 12 },
      { header: "Active", key: "active", width: 10 },
    ];

    // 4. Add data rows
    employees.forEach((emp) => {
      worksheet.addRow(emp);
    });

    // 5. Set response headers
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=employees.xlsx"
    );

    // 6. Write workbook to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Excel export error:", err);
    res.status(500).json({ error: "Failed to export Excel file" });
  }
});

module.exports = router;