const express = require('express');
const router  = express.Router();
const db      = require('../config/db');

// ─────────────────────────────────────────────────────────────────
// TRAINING TYPES
// ─────────────────────────────────────────────────────────────────

// GET /api/training-registry/types
router.get('/types', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        tt.*,
        e.name AS created_by_name,
        COUNT(tr.id)::int AS total_records
      FROM training_types tt
      LEFT JOIN employees e  ON e.employee_id = tt.created_by
      LEFT JOIN training_records tr ON tr.training_type_id = tt.id
      WHERE tt.active = TRUE
      GROUP BY tt.id, e.name
      ORDER BY tt.name ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching training types:', err);
    res.status(500).json({ error: 'Failed to fetch training types' });
  }
});

// GET /api/training-registry/types/:id
router.get('/types/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM training_types WHERE id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching training type:', err);
    res.status(500).json({ error: 'Failed to fetch training type' });
  }
});

// POST /api/training-registry/types
// Body: { name, description, frequency_days, warning_days[], notify_employee_ids[], created_by }
router.post('/types', async (req, res) => {
  try {
    const {
      name,
      description,
      frequency_days,
      warning_days,
      notify_employee_ids,
      created_by
    } = req.body;

    if (!name || !frequency_days || !created_by) {
      return res.status(400).json({ error: 'name, frequency_days, and created_by are required' });
    }

    const { rows } = await db.query(`
      INSERT INTO training_types
        (name, description, frequency_days, warning_days, notify_employee_ids, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      name,
      description || null,
      frequency_days,
      warning_days || [30],
      notify_employee_ids || [],
      created_by
    ]);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error creating training type:', err);
    res.status(500).json({ error: 'Failed to create training type' });
  }
});

// PATCH /api/training-registry/types/:id
router.patch('/types/:id', async (req, res) => {
  try {
    const BLOCKED = ['id', 'created_by', 'created_at'];
    const safe = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => !BLOCKED.includes(k))
    );
    if (!Object.keys(safe).length) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const keys   = Object.keys(safe);
    const vals   = Object.values(safe);
    const setCl  = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');

    const { rows } = await db.query(
      `UPDATE training_types SET ${setCl}, updated_at = NOW() WHERE id = $${keys.length + 1} RETURNING *`,
      [...vals, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating training type:', err);
    res.status(500).json({ error: 'Failed to update training type' });
  }
});

// DELETE /api/training-registry/types/:id  (soft delete)
router.delete('/types/:id', async (req, res) => {
  try {
    await db.query(
      `UPDATE training_types SET active = FALSE, updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting training type:', err);
    res.status(500).json({ error: 'Failed to delete training type' });
  }
});

// ─────────────────────────────────────────────────────────────────
// TRAINING RECORDS
// ─────────────────────────────────────────────────────────────────

// GET /api/training-registry/records
// ?training_type_id=&employee_id=&expired=true&expiring_soon=true
router.get('/records', async (req, res) => {
  try {
    const { training_type_id, employee_id, expired, expiring_soon } = req.query;

    let query = `
      SELECT
        tr.*,
        e.name            AS employee_name,
        e.department      AS department,
        e.shift           AS shift,
        ldr.name          AS leader_name,
        ldr.employee_id   AS leader_id,
        tt.name           AS training_type_name,
        tt.frequency_days,
        CASE
          WHEN tr.expiry_date < CURRENT_DATE          THEN 'expired'
          WHEN tr.expiry_date <= CURRENT_DATE + (SELECT MIN(d) FROM unnest(tt.warning_days) d) * INTERVAL '1 day'
                                                      THEN 'expiring_soon'
          ELSE 'current'
        END AS status
      FROM training_records tr
      JOIN employees    e   ON e.employee_id   = tr.employee_id
      LEFT JOIN employees ldr ON ldr.employee_id = e.leader_id
      JOIN training_types tt  ON tt.id           = tr.training_type_id
      WHERE 1=1
    `;
    const params = [];

    if (training_type_id) {
      params.push(training_type_id);
      query += ` AND tr.training_type_id = $${params.length}`;
    }
    if (employee_id) {
      params.push(employee_id);
      query += ` AND tr.employee_id = $${params.length}`;
    }
    if (expired === 'true') {
      query += ` AND tr.expiry_date < CURRENT_DATE`;
    }
    if (expiring_soon === 'true') {
      query += ` AND tr.expiry_date >= CURRENT_DATE
                 AND tr.expiry_date <= CURRENT_DATE + (
                   SELECT MAX(d) FROM unnest(tt.warning_days) d
                 ) * INTERVAL '1 day'`;
    }

    query += ` ORDER BY tr.training_date DESC`;

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching training records:', err);
    res.status(500).json({ error: 'Failed to fetch training records' });
  }
});

// GET /api/training-registry/records/summary
// Returns latest record per employee per training type — the "current status" view
router.get('/records/summary', async (req, res) => {
  try {
    const { training_type_id, department, leader_id, status } = req.query;

    let having = '';
    const params = [];

    if (training_type_id) {
      params.push(training_type_id);
      having += ` AND tr.training_type_id = $${params.length}`;
    }

    const { rows } = await db.query(`
      SELECT DISTINCT ON (tr.employee_id, tr.training_type_id)
        tr.id,
        tr.employee_id,
        tr.training_type_id,
        tr.training_date,
        tr.expiry_date,
        tr.logged_by,
        tr.notes,
        e.name          AS employee_name,
        e.department,
        e.shift,
        ldr.name        AS leader_name,
        ldr.employee_id AS leader_id,
        tt.name         AS training_type_name,
        tt.frequency_days,
        tt.warning_days,
        CASE
          WHEN tr.expiry_date < CURRENT_DATE  THEN 'expired'
          WHEN tr.expiry_date <= CURRENT_DATE + (
            SELECT MIN(d) FROM unnest(tt.warning_days) d
          ) * INTERVAL '1 day'               THEN 'expiring_soon'
          ELSE 'current'
        END AS status
      FROM training_records tr
      JOIN employees     e   ON e.employee_id   = tr.employee_id
      LEFT JOIN employees ldr ON ldr.employee_id = e.leader_id
      JOIN training_types tt  ON tt.id           = tr.training_type_id
      WHERE tt.active = TRUE
        AND e.active  = TRUE
        ${having}
      ORDER BY tr.employee_id, tr.training_type_id, tr.training_date DESC
    `, params);

    // Apply post-query filters (department, leader, status)
    let filtered = rows;
    if (department)   filtered = filtered.filter(r => r.department === department);
    if (leader_id)    filtered = filtered.filter(r => r.leader_id  === leader_id);
    if (status)       filtered = filtered.filter(r => r.status     === status);

    res.json(filtered);
  } catch (err) {
    console.error('Error fetching training summary:', err);
    res.status(500).json({ error: 'Failed to fetch training summary' });
  }
});

// GET /api/training-registry/records/employee/:employeeId
// All training records for one employee, one row per type (latest)
router.get('/records/employee/:employeeId', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT DISTINCT ON (tr.training_type_id)
        tr.*,
        tt.name           AS training_type_name,
        tt.frequency_days,
        tt.warning_days,
        CASE
          WHEN tr.expiry_date < CURRENT_DATE  THEN 'expired'
          WHEN tr.expiry_date <= CURRENT_DATE + (
            SELECT MIN(d) FROM unnest(tt.warning_days) d
          ) * INTERVAL '1 day'               THEN 'expiring_soon'
          ELSE 'current'
        END AS status
      FROM training_records tr
      JOIN training_types tt ON tt.id = tr.training_type_id
      WHERE tr.employee_id = $1
        AND tt.active = TRUE
      ORDER BY tr.training_type_id, tr.training_date DESC
    `, [req.params.employeeId]);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching employee training records:', err);
    res.status(500).json({ error: 'Failed to fetch employee training records' });
  }
});

// POST /api/training-registry/records
// Log a training completion
// Body: { training_type_id, employee_id, training_date, logged_by, notes }
router.post('/records', async (req, res) => {
  try {
    const { training_type_id, employee_id, training_date, logged_by, notes } = req.body;

    if (!training_type_id || !employee_id || !training_date || !logged_by) {
      return res.status(400).json({
        error: 'training_type_id, employee_id, training_date, and logged_by are required'
      });
    }

    // Fetch frequency_days from the training type
    const typeResult = await db.query(
      `SELECT frequency_days FROM training_types WHERE id = $1 AND active = TRUE`,
      [training_type_id]
    );
    if (!typeResult.rows.length) {
      return res.status(404).json({ error: 'Training type not found or inactive' });
    }
    const { frequency_days } = typeResult.rows[0];

    // Compute expiry date
    const expiry = new Date(training_date);
    expiry.setDate(expiry.getDate() + frequency_days);
    const expiry_date = expiry.toISOString().split('T')[0];

    // Fetch employee to validate + get name
    const empResult = await db.query(
      `SELECT employee_id, name, leader_id FROM employees WHERE employee_id = $1 AND active = TRUE`,
      [employee_id]
    );
    if (!empResult.rows.length) {
      return res.status(404).json({ error: 'Employee not found or inactive' });
    }

    const { rows } = await db.query(`
      INSERT INTO training_records
        (training_type_id, employee_id, training_date, expiry_date, logged_by, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (training_type_id, employee_id, training_date)
      DO UPDATE SET
        expiry_date = EXCLUDED.expiry_date,
        logged_by   = EXCLUDED.logged_by,
        notes       = EXCLUDED.notes
      RETURNING *
    `, [training_type_id, employee_id, training_date, expiry_date, logged_by, notes || null]);

    // Return with enriched data
    const record = rows[0];
    const emp    = empResult.rows[0];

    res.status(201).json({
      ...record,
      employee_name:      emp.name,
      leader_id:          emp.leader_id,
      training_type_name: typeResult.rows[0].name
    });
  } catch (err) {
    console.error('Error logging training record:', err);
    res.status(500).json({ error: 'Failed to log training record' });
  }
});

// POST /api/training-registry/records/bulk
// Log multiple employees at once for the same training event
// Body: { training_type_id, employee_ids[], training_date, logged_by, notes }
router.post('/records/bulk', async (req, res) => {
  try {
    const { training_type_id, employee_ids, training_date, logged_by, notes } = req.body;

    if (!training_type_id || !Array.isArray(employee_ids) || !employee_ids.length || !training_date || !logged_by) {
      return res.status(400).json({ error: 'training_type_id, employee_ids[], training_date, and logged_by are required' });
    }

    const typeResult = await db.query(
      `SELECT frequency_days, name FROM training_types WHERE id = $1 AND active = TRUE`,
      [training_type_id]
    );
    if (!typeResult.rows.length) {
      return res.status(404).json({ error: 'Training type not found or inactive' });
    }
    const { frequency_days, name: type_name } = typeResult.rows[0];

    const expiry = new Date(training_date);
    expiry.setDate(expiry.getDate() + frequency_days);
    const expiry_date = expiry.toISOString().split('T')[0];

    const results = [];
    const errors  = [];

    for (const employee_id of employee_ids) {
      try {
        // Validate employee exists
        const empCheck = await db.query(
          `SELECT employee_id, name, leader_id FROM employees WHERE employee_id = $1 AND active = TRUE`,
          [employee_id]
        );
        if (!empCheck.rows.length) {
          errors.push({ employee_id, error: 'Employee not found or inactive' });
          continue;
        }

        const { rows } = await db.query(`
          INSERT INTO training_records
            (training_type_id, employee_id, training_date, expiry_date, logged_by, notes)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (training_type_id, employee_id, training_date)
          DO UPDATE SET
            expiry_date = EXCLUDED.expiry_date,
            logged_by   = EXCLUDED.logged_by,
            notes       = EXCLUDED.notes
          RETURNING *
        `, [training_type_id, employee_id, training_date, expiry_date, logged_by, notes || null]);

        results.push({
          ...rows[0],
          employee_name:      empCheck.rows[0].name,
          leader_id:          empCheck.rows[0].leader_id,
          training_type_name: type_name
        });
      } catch (rowErr) {
        errors.push({ employee_id, error: rowErr.message });
      }
    }

    res.status(201).json({ logged: results, errors });
  } catch (err) {
    console.error('Error bulk logging training records:', err);
    res.status(500).json({ error: 'Failed to bulk log training records' });
  }
});

// DELETE /api/training-registry/records/:id
router.delete('/records/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      `DELETE FROM training_records WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Record not found' });
    res.json({ success: true, deleted: rows[0] });
  } catch (err) {
    console.error('Error deleting training record:', err);
    res.status(500).json({ error: 'Failed to delete training record' });
  }
});

// ─────────────────────────────────────────────────────────────────
// COVERAGE GAPS — employees who have no record for a training type
// GET /api/training-registry/gaps/:trainingTypeId
// ─────────────────────────────────────────────────────────────────
router.get('/gaps/:trainingTypeId', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        e.employee_id,
        e.name,
        e.department,
        e.shift,
        ldr.name        AS leader_name,
        ldr.employee_id AS leader_id,
        tr.training_date,
        tr.expiry_date,
        CASE
          WHEN tr.id IS NULL                         THEN 'never_trained'
          WHEN tr.expiry_date < CURRENT_DATE         THEN 'expired'
          WHEN tr.expiry_date <= CURRENT_DATE + (
            SELECT MIN(d) FROM unnest(tt.warning_days) d
          ) * INTERVAL '1 day'                       THEN 'expiring_soon'
          ELSE 'current'
        END AS status
      FROM employees e
      LEFT JOIN employees ldr ON ldr.employee_id = e.leader_id
      JOIN training_types tt ON tt.id = $1 AND tt.active = TRUE
      LEFT JOIN LATERAL (
        SELECT tr2.*
        FROM training_records tr2
        WHERE tr2.employee_id      = e.employee_id
          AND tr2.training_type_id = $1
        ORDER BY tr2.training_date DESC
        LIMIT 1
      ) tr ON TRUE
      WHERE e.active = TRUE
      ORDER BY
        CASE
          WHEN tr.id IS NULL              THEN 0
          WHEN tr.expiry_date < CURRENT_DATE THEN 1
          ELSE 2
        END,
        e.name
    `, [req.params.trainingTypeId]);

    res.json(rows);
  } catch (err) {
    console.error('Error fetching training gaps:', err);
    res.status(500).json({ error: 'Failed to fetch training gaps' });
  }
});

module.exports = router;
