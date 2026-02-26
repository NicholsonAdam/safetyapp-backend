const express = require("express");
const router = express.Router();
const fs = require("fs-extra");
const path = require("path");
const { exec } = require("child_process");
const pool = require("../config/db");

// SHARE DRIVE PATH
const HuddleSource = "Z:/Adam/SafetyApp/Huddles";

// OUTPUT PDF FOLDER
const PdfOutput = path.join(__dirname, "..", "huddles", "pdf");

// Ensure output folder exists
fs.ensureDirSync(PdfOutput);

// Convert a single DOCX file to PDF
function convertToPDF(docxPath, pdfPath) {
  return new Promise((resolve, reject) => {
    const command = `"C:/Program Files/LibreOffice/program/soffice.exe" --headless --convert-to pdf --outdir "${PdfOutput}" "${docxPath}"`;

    exec(command, (error) => {
      // Windows LibreOffice often returns exit code 1 even on success.
      // So we check if the PDF exists.
      if (fs.existsSync(pdfPath)) {
        return resolve();
      }

      // If PDF does NOT exist, then it's a real failure
      if (error) {
        console.error("Conversion error:", error);
        return reject(error);
      }

      resolve();
    });
  });
}

// GET /api/huddles → list all available huddles
router.get("/", async (req, res) => {
  try {
    const files = await fs.readdir(HuddleSource);

    const docxFiles = files.filter((f) => f.toLowerCase().endsWith(".docx"));

    const huddles = [];

    for (const file of docxFiles) {
      const weekMatch = file.match(/Week(\d+)/i);
      if (!weekMatch) continue;

      const weekString = weekMatch[1];   // preserves 01, 02, 03, etc.
      const week = parseInt(weekString, 10);

      const docxPath = path.join(HuddleSource, file);
      const pdfPath = path.join(PdfOutput, `Week${weekString}.pdf`);

      // Convert if PDF does not exist
      if (!fs.existsSync(pdfPath)) {
        await convertToPDF(docxPath, pdfPath);
      }

      huddles.push({
        week,
        pdf_url: `http://10.122.77.9:3000/huddles/pdf/Week${weekString}.pdf`,
      });
    }

    // Sort by week number
    huddles.sort((a, b) => a.week - b.week);

    res.json(huddles);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load huddles" });
  }
});

// POST /api/huddles/sign → record signature
router.post("/sign", async (req, res) => {
  try {
    const { employee_id, week, year } = req.body;

    // Insert into PostgreSQL
    await pool.query(
      `
      INSERT INTO huddle_signatures (employee_id, week, year)
      VALUES ($1, $2, $3)
      ON CONFLICT (employee_id, week, year) DO NOTHING
      `,
      [employee_id, week, year]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Error saving huddle signature:", err);
    res.status(500).json({ error: "Failed to save signature" });
  }
});

// GET /api/huddles/employee/:employee_id → admin view for one employee
router.get("/employee/:employee_id", async (req, res) => {
  try {
    const { employee_id } = req.params;

    // 1) Get employee info (for created_at)
    const empResult = await pool.query(
      "SELECT employee_id, name, created_at FROM employees WHERE employee_id = $1",
      [employee_id]
    );

    if (empResult.rows.length === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const employee = empResult.rows[0];

    // 2) Load huddles dynamically from the share drive (same as main route)
const files = await fs.readdir(HuddleSource);
const docxFiles = files.filter((f) => f.toLowerCase().endsWith(".docx"));

const huddles = [];

for (const file of docxFiles) {
  const weekMatch = file.match(/Week(\d+)/i);
  if (!weekMatch) continue;

  const weekString = weekMatch[1];
  const week = parseInt(weekString, 10);
  const year = new Date().getFullYear(); // assume current year

  const docxPath = path.join(HuddleSource, file);
  const pdfPath = path.join(PdfOutput, `Week${weekString}.pdf`);

  // Convert if PDF does not exist
  if (!fs.existsSync(pdfPath)) {
    await convertToPDF(docxPath, pdfPath);
  }

  huddles.push({
    week,
    year,
    pdf_url: `http://10.122.77.9:3000/huddles/pdf/Week${weekString}.pdf`,
  });
}

// Sort by week
huddles.sort((a, b) => a.week - b.week);

    // 3) Get all signatures for this employee
    const sigResult = await pool.query(
      `
      SELECT week, year, signed_at
      FROM huddle_signatures
      WHERE employee_id = $1
      `,
      [employee_id]
    );

    const signatures = sigResult.rows;

    // 4) Build a quick lookup map
    const sigMap = {};
    for (const s of signatures) {
      sigMap[`${s.year}-${s.week}`] = s;
    }

    // 5) Compute required + signed for each huddle
    const createdAt = new Date(employee.created_at);

    const result = huddles.map((h) => {
      const huddleDate = new Date(h.year, 0, 1 + (h.week - 1) * 7);
      const key = `${h.year}-${h.week}`;
      const sig = sigMap[key];

      const required = huddleDate >= createdAt;
      const signed = !!sig;

      return {
        week: h.week,
        year: h.year,
        pdf_url: h.pdf_url,
        required,
        signed,
        signed_at: sig ? sig.signed_at : null,
      };
    });

    res.json({
      employee: {
        employee_id: employee.employee_id,
        name: employee.name,
        created_at: employee.created_at,
      },
      huddles: result,
    });
  } catch (err) {
    console.error("Error fetching employee huddles:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/huddles/week/:year/:week → admin view for one week
router.get("/week/:year/:week", async (req, res) => {
  try {
    const year = parseInt(req.params.year, 10);
    const week = parseInt(req.params.week, 10);
    const { department, leader } = req.query;

    // 1) Load all employees with department + leader_id
    const empResult = await pool.query(
      `
      SELECT employee_id, name, department, leader_id, created_at
      FROM employees
      WHERE active = true
      ORDER BY name
      `
    );
    let employees = empResult.rows;

    // 2) Apply department filter
    if (department && department.trim() !== "") {
      employees = employees.filter((e) => e.department === department);
    }

    // 3) Apply leader filter
    if (leader && leader.trim() !== "") {
      employees = employees.filter(
        (e) => String(e.leader_id) === String(leader)
      );
    }

    // 4) Get signatures for this week/year
    const sigResult = await pool.query(
      `
      SELECT employee_id, signed_at
      FROM huddle_signatures
      WHERE week = $1 AND year = $2
      `,
      [week, year]
    );
    const signatures = sigResult.rows;

    const sigMap = {};
    for (const s of signatures) {
      sigMap[s.employee_id] = s;
    }

    // 5) Build final result
    const huddleDate = new Date(year, 0, 1 + (week - 1) * 7);

    const result = employees.map((e) => {
      const createdAt = new Date(e.created_at);
      const required = huddleDate >= createdAt;
      const sig = sigMap[e.employee_id];
      const signed = !!sig;

      return {
        employee_id: e.employee_id,
        name: e.name,
        department: e.department,
        leader_id: e.leader_id,
        required,
        signed,
        signed_at: sig ? sig.signed_at : null,
      };
    });

    res.json({
      year,
      week,
      employees: result,
    });
  } catch (err) {
    console.error("Error fetching week huddles:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/huddles/full-year → Excel export matrix
router.get("/full-year", async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10);
    const { department, leader } = req.query;

    // 1) Load all employees with department + leader_id
    const empResult = await pool.query(
      `
      SELECT employee_id, name, department, leader_id, created_at
      FROM employees
      WHERE active = true
      ORDER BY name
      `
    );
    let employees = empResult.rows;

    // 2) Apply department filter
    if (department && department.trim() !== "") {
      employees = employees.filter((e) => e.department === department);
    }

    // 3) Apply leader filter
    if (leader && leader.trim() !== "") {
      employees = employees.filter(
        (e) => String(e.leader_id) === String(leader)
      );
    }

    // 4) Load all signatures for the entire year
    const sigResult = await pool.query(
      `
      SELECT employee_id, week, signed_at
      FROM huddle_signatures
      WHERE year = $1
      `,
      [year]
    );

    const signatures = sigResult.rows;

    // Build lookup: sigMap[employee_id][week] = signed_at
    const sigMap = {};
    for (const s of signatures) {
      if (!sigMap[s.employee_id]) sigMap[s.employee_id] = {};
      sigMap[s.employee_id][s.week] = s.signed_at;
    }

    // 5) Build the Excel matrix
    const rows = [];

    for (const emp of employees) {
      const row = {
        Employee: `${emp.name} (${emp.employee_id})`,
        Department: emp.department,
        Leader: emp.leader_id,
      };

      const hireDate = new Date(emp.created_at);

      for (let w = 1; w <= 52; w++) {
        const huddleDate = new Date(year, 0, 1 + (w - 1) * 7);

        if (huddleDate < hireDate) {
          row[`Week ${w}`] = "-"; // not required
          continue;
        }

        const signed = sigMap[emp.employee_id]?.[w];

        if (signed) {
          row[`Week ${w}`] = "✔";
        } else {
          row[`Week ${w}`] = "✘";
        }
      }

      rows.push(row);
    }

    res.json({ rows });
  } catch (err) {
    console.error("Error building full-year export:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;