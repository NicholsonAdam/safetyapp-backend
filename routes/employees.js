const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// GET ALL / SEARCH
router.get("/", async (req, res) => {
  try {
    const search = req.query.search || "";

    if (search.length > 0) {
      const result = await pool.query(
        `SELECT employee_id, name
         FROM employees
         WHERE name ILIKE $1 || '%'
         ORDER BY name
         LIMIT 20`,
        [search]
      );
      return res.json(result.rows);
    }

    const result = await pool.query(
      "SELECT * FROM employees ORDER BY employee_id ASC"
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching employees:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// GET LEADERS ONLY (site_admin = true) — must be before /:employee_id
router.get("/leaders", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT employee_id, name, email
       FROM employees
       WHERE site_admin = true AND (active IS NULL OR active = true)
       ORDER BY name ASC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching leaders:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ADD EMPLOYEE
router.post("/", async (req, res) => {
  try {
    const {
      employee_id, name, department, job_title,
      shift, leader_id, email, site_admin
    } = req.body;

    const result = await pool.query(
      `INSERT INTO employees 
        (employee_id, name, department, job_title, shift, leader_id, email, site_admin)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [employee_id, name, department, job_title, shift, leader_id, email, site_admin]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error adding employee:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// FULL UPDATE
router.put("/:employee_id", async (req, res) => {
  try {
    const { employee_id } = req.params;
    const {
      name, department, job_title, shift,
      leader_id, email, site_admin, active
    } = req.body;

    const result = await pool.query(
      `UPDATE employees
       SET name=$1, department=$2, job_title=$3, shift=$4,
           leader_id=$5, email=$6, site_admin=$7, active=$8
       WHERE employee_id=$9
       RETURNING *`,
      [name, department, job_title, shift, leader_id, email, site_admin, active, employee_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating employee:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// PARTIAL UPDATE
router.patch("/:employee_id", async (req, res) => {
  try {
    const { employee_id } = req.params;
    const fields = req.body;

    if (!fields || Object.keys(fields).length === 0) {
      return res.status(400).json({ message: "No fields provided to update" });
    }

    const keys = Object.keys(fields);
    const values = Object.values(fields);
    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(", ");

    const result = await pool.query(
      `UPDATE employees SET ${setClause} WHERE employee_id = $${keys.length + 1} RETURNING *`,
      [...values, employee_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error patching employee:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE
router.delete("/:employee_id", async (req, res) => {
  try {
    const { employee_id } = req.params;

    const result = await pool.query(
      "DELETE FROM employees WHERE employee_id = $1 RETURNING *",
      [employee_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.json({ message: "Employee deleted successfully" });
  } catch (error) {
    console.error("Error deleting employee:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;