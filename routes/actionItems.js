const express = require('express');
const router = express.Router();
const db = require('../config/db');

// ---------------------------------------------
// Helper: Build WHERE clause for multi-select filters
// ---------------------------------------------
function buildArrayFilter(column, values, params, queryParts) {
  if (Array.isArray(values) && values.length > 0) {
    const placeholders = values.map(v => {
      params.push(v);
      return `$${params.length}`;
    });
    queryParts.push(`(${column} IN (${placeholders.join(', ')}))`);
  }
}

// ---------------------------------------------
// GET FILTERED ACTION ITEMS
// ---------------------------------------------
async function getFilteredActionItems(filters = {}) {
  const {
    status = [],
    department = [],
    classification = [],
    search = null,
    sort = 'id',
    direction = 'asc',
  } = filters;

  let queryParts = [];
  let params = [];

  // Multi-select filters
  buildArrayFilter("status", status, params, queryParts);
  buildArrayFilter("department", department, params, queryParts);
  buildArrayFilter("classification", classification, params, queryParts);

  // Search filter
  if (search) {
    params.push(`%${search}%`);
    queryParts.push(`(description ILIKE $${params.length} OR notes ILIKE $${params.length})`);
  }

  // Build WHERE clause
  let whereClause = queryParts.length > 0
    ? "WHERE " + queryParts.join(" AND ")
    : "";

  // Sorting
  const allowedSort = [
    'id',
    'date_submitted',
    'date_last_update',
    'status',
    'department',
    'classification',
    'submitted_by_user_id',
    'current_owner_user_id'
  ];

  const safeSort = allowedSort.includes(sort) ? sort : 'id';
  const safeDirection = direction === 'desc' ? 'desc' : 'asc';

  const query = `
    SELECT *
    FROM action_items
    ${whereClause}
    ORDER BY ${safeSort} ${safeDirection};
  `;

  const { rows } = await db.query(query, params);
  return rows;
}

// ---------------------------------------------
// GET /api/action-items
// ---------------------------------------------
router.get('/', async (req, res) => {
  try {
    const filters = {
      status: req.query.status ? [].concat(req.query.status) : [],
      department: req.query.department ? [].concat(req.query.department) : [],
      classification: req.query.classification ? [].concat(req.query.classification) : [],
      search: req.query.search || null,
      sort: req.query.sort || 'id',
      direction: req.query.direction || 'asc',
    };

    const rows = await getFilteredActionItems(filters);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching action items:', err);
    res.status(500).json({ error: 'Failed to fetch action items' });
  }
});

// ---------------------------------------------
// PATCH /api/action-items/:id
// ---------------------------------------------
router.patch('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const fields = req.body;

    if (!fields || Object.keys(fields).length === 0) {
      return res.status(400).json({ error: 'No fields provided to update' });
    }

    const keys = Object.keys(fields);
    const values = Object.values(fields);

    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');

    const query = `
      UPDATE action_items
      SET ${setClause},
          date_last_update = NOW()
      WHERE id = $${keys.length + 1}
      RETURNING *;
    `;

    const { rows } = await db.query(query, [...values, id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Action item not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating action item:', err);
    res.status(500).json({ error: 'Failed to update action item' });
  }
});

// ---------------------------------------------
// CREATE NEW ACTION ITEM
// ---------------------------------------------
router.post('/', async (req, res) => {
  try {
    const {
      submitted_by_user_id,
      current_owner_user_id,
      description,
      department,
      classification,
      status,
      notes,
    } = req.body;

    // IMPORTANT:
    // DO NOT INSERT date_submitted or date_last_update
    // They are generated columns in Postgres.

    const query = `
      INSERT INTO action_items
      (submitted_by_user_id, current_owner_user_id, description, department, classification, status, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;

    const params = [
      submitted_by_user_id,
      current_owner_user_id,
      description,
      department,
      classification,
      status,
      notes,
    ];

    const { rows } = await db.query(query, params);

    res.json(rows[0]);
  } catch (err) {
    console.error('Error creating action item:', err);
    res.status(500).json({ error: 'Failed to create action item' });
  }
});

// ---------------------------------------------
// EXPORT TO EXCEL
// ---------------------------------------------
router.get('/export/excel', async (req, res) => {
  try {
    const XLSX = require('xlsx');

    const filters = {
      status: req.query.status ? [].concat(req.query.status) : [],
      department: req.query.department ? [].concat(req.query.department) : [],
      classification: req.query.classification ? [].concat(req.query.classification) : [],
      search: req.query.search || null,
      sort: req.query.sort || 'id',
      direction: req.query.direction || 'asc',
    };

    const rows = await getFilteredActionItems(filters);

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Action Items');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="action_items.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    console.error('Excel export error:', err);
    res.status(500).json({ error: 'Failed to export Excel' });
  }
});

module.exports = router;
