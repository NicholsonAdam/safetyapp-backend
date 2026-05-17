const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { uploadPhotos } = require('../middleware/upload');

// ---------------------------------------------
// GET FILTERED ACTION ITEMS (scalar filters)
// ---------------------------------------------
async function getFilteredActionItems(filters = {}) {
  const {
    status = null,
    department = null,
    classification = null,
    owner = null,
    element = null,
    search = null,
    sort = 'id',
    direction = 'asc',
  } = filters;

  let query = `
    SELECT *
    FROM action_items
    WHERE 1=1
  `;

  const params = [];

  if (status) {
    params.push(status);
    query += ` AND status = $${params.length}`;
  }

  if (department) {
    params.push(department);
    query += ` AND department = $${params.length}`;
  }

  if (classification) {
    params.push(classification);
    query += ` AND classification = $${params.length}`;
  }

  if (owner) {
    params.push(owner);
    query += ` AND current_owner_user_id = $${params.length}`;
  }

  if (element) {
    params.push(element);
    query += ` AND element = $${params.length}`;
  }

  if (search) {
    params.push(`%${search}%`);
    query += ` AND (description ILIKE $${params.length} OR notes ILIKE $${params.length})`;
  }

  const allowedSort = [
    'id',
    'date_submitted',
    'date_last_update',
    'status',
    'department',
    'classification',
    'submitted_by_user_id',
    'current_owner_user_id',
    'source_type',
    'element',
  ];

  const safeSort      = allowedSort.includes(sort) ? sort : 'id';
  const safeDirection = direction === 'desc' ? 'desc' : 'asc';

  query += ` ORDER BY ${safeSort} ${safeDirection}`;

  const { rows } = await db.query(query, params);
  return rows;
}

// ---------------------------------------------
// GET /api/action-items
// ---------------------------------------------
router.get('/', async (req, res) => {
  try {
    const filters = {
      status:         req.query.status         || null,
      department:     req.query.department     || null,
      classification: req.query.classification || null,
      owner:          req.query.owner          || null,
      element:        req.query.element        || null,
      search:         req.query.search         || null,
      sort:           req.query.sort           || 'id',
      direction:      req.query.direction      || 'asc',
    };

    const rows = await getFilteredActionItems(filters);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching action items:', err);
    res.status(500).json({ error: 'Failed to fetch action items' });
  }
});

// ---------------------------------------------
// POST /api/action-items
// Create a new action item
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
      element,
    } = req.body;

    const query = `
      INSERT INTO action_items
        (submitted_by_user_id, current_owner_user_id, description, department,
         classification, status, notes, element)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;

    const { rows } = await db.query(query, [
      submitted_by_user_id,
      current_owner_user_id,
      description,
      department,
      classification,
      status,
      notes,
      element,
    ]);

    res.json(rows[0]);
  } catch (err) {
    console.error('Error creating action item:', err);
    res.status(500).json({ error: 'Failed to create action item' });
  }
});

// ---------------------------------------------
// PATCH /api/action-items/:id
// General field update (text, selects, etc.)
// NOT used for photo attachments — those use the
// dedicated photo endpoints below to avoid hitting
// the Express JSON body size limit with base64 data.
// ---------------------------------------------
router.patch('/:id', async (req, res) => {
  try {
    const id     = req.params.id;
    const fields = req.body;

    if (!fields || Object.keys(fields).length === 0) {
      return res.status(400).json({ error: 'No fields provided to update' });
    }

    const keys   = Object.keys(fields);
    const values = Object.values(fields);

    const setClause = keys.map((key, i) => `"${key}" = $${i + 1}`).join(', ');

    const query = `
      UPDATE action_items
      SET ${setClause}, date_last_update = CURRENT_DATE
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
// POST /api/action-items/:id/photos
// Upload a photo for an action item.
//
// Uses multipart/form-data — file field name: "photo"
// Multer saves the file to /data/uploads/ with a unique name.
// We store { type, url, name, size } in the attachments jsonb column.
//
// The public URL is /files/:filename because server.js has:
//   app.get("/files/:filename", (req, res) => res.sendFile(...))
// pointing at /data/uploads/
// ---------------------------------------------
router.post('/:id/photos', uploadPhotos.single('photo'), async (req, res) => {
  try {
    const id = req.params.id;

    if (!req.file) {
      return res.status(400).json({ error: 'No photo file provided' });
    }

    // Build the URL using the existing /files/:filename route in server.js
    const photoUrl = `/files/${req.file.filename}`;

    const attachment = {
      type: 'photo',
      url:  photoUrl,
      name: req.file.originalname,
      size: req.file.size,
    };

    // Append to jsonb array atomically — no full-row read/write needed
    const query = `
      UPDATE action_items
      SET
        attachments      = COALESCE(attachments, '[]'::jsonb) || $1::jsonb,
        date_last_update = CURRENT_DATE
      WHERE id = $2
      RETURNING *;
    `;

    const { rows } = await db.query(query, [JSON.stringify([attachment]), id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Action item not found' });
    }

    res.json({ attachment, item: rows[0] });
  } catch (err) {
    console.error('Error uploading action item photo:', err);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

// ---------------------------------------------
// DELETE /api/action-items/:id/photos
// Remove a single photo from the attachments array by URL.
// Body: { url: "/files/filename.jpg" }
// The physical file is left on disk (safe to clean up separately).
// ---------------------------------------------
router.delete('/:id/photos', async (req, res) => {
  try {
    const id  = req.params.id;
    const url = req.body?.url;

    if (!url) {
      return res.status(400).json({ error: 'url is required in request body' });
    }

    // Filter the matching entry out of the jsonb array in Postgres
    const query = `
      UPDATE action_items
      SET
        attachments = (
          SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
          FROM   jsonb_array_elements(COALESCE(attachments, '[]'::jsonb)) AS elem
          WHERE  elem->>'url' <> $1
        ),
        date_last_update = CURRENT_DATE
      WHERE id = $2
      RETURNING *;
    `;

    const { rows } = await db.query(query, [url, id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Action item not found' });
    }

    res.json({ success: true, item: rows[0] });
  } catch (err) {
    console.error('Error removing action item photo:', err);
    res.status(500).json({ error: 'Failed to remove photo' });
  }
});

// ---------------------------------------------
// GET /api/action-items/export/excel
// ---------------------------------------------
router.get('/export/excel', async (req, res) => {
  try {
    const XLSX = require('xlsx');

    const filters = {
      status:         req.query.status         || null,
      department:     req.query.department     || null,
      classification: req.query.classification || null,
      owner:          req.query.owner          || null,
      element:        req.query.element        || null,
      search:         req.query.search         || null,
      sort:           req.query.sort           || 'id',
      direction:      req.query.direction      || 'asc',
    };

    const rows = await getFilteredActionItems(filters);

    // Strip the raw attachments blob from the export — not useful in Excel
    const exportRows = rows.map(r => {
      const { attachments, ...rest } = r;
      return {
        ...rest,
        photo_count: Array.isArray(attachments)
          ? attachments.filter(a => a.type === 'photo').length
          : 0,
      };
    });

    const workbook  = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(exportRows);
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
