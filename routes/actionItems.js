const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { uploadPhotos } = require('../middleware/upload');

// ---------------------------------------------
// GET FILTERED ACTION ITEMS (scalar filters)
// ---------------------------------------------
async function getFilteredActionItems(filters = {}) {
  const {
    status         = null,
    hide_complete  = false,
    department     = null,
    classification = null,
    owner          = null,
    element        = null,
    search         = null,
    sort           = 'id',
    direction      = 'asc',
  } = filters;

  let query = `SELECT * FROM action_items WHERE 1=1`;
  const params = [];

  if (status) {
    params.push(status);
    query += ` AND status = $${params.length}`;
  } else if (hide_complete) {
    query += ` AND status != 'COMPLETE'`;
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
    'id', 'date_submitted', 'date_last_update', 'status',
    'department', 'classification', 'submitted_by_user_id',
    'current_owner_user_id', 'source_type', 'element',
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
      hide_complete:  req.query.hide_complete === 'true',
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
        (submitted_by_user_id, current_owner_user_id, description,
         department, classification, status, notes, element)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const { rows } = await db.query(query, [
      submitted_by_user_id, current_owner_user_id, description,
      department, classification, status, notes, element,
    ]);
    res.json(rows[0]);
  } catch (err) {
    console.error('Error creating action item:', err);
    res.status(500).json({ error: 'Failed to create action item' });
  }
});

// ---------------------------------------------
// PATCH /api/action-items/:id
// General field updates (text, selects, notes).
// NOTE: date_last_update is a GENERATED column — Postgres updates
// it automatically. Never include it in a SET clause.
// ---------------------------------------------
router.patch('/:id', async (req, res) => {
  try {
    const id     = req.params.id;
    const fields = req.body;

    if (!fields || Object.keys(fields).length === 0) {
      return res.status(400).json({ error: 'No fields provided to update' });
    }

    // Strip any attempt to manually set generated/immutable columns
    const BLOCKED = ['id', 'created_at', 'updated_at', 'date_last_update',
                     'submitted_by_user_id'];
    const safeFields = Object.fromEntries(
      Object.entries(fields).filter(([k]) => !BLOCKED.includes(k))
    );

    if (Object.keys(safeFields).length === 0) {
      return res.status(400).json({ error: 'No updatable fields provided' });
    }

    const keys      = Object.keys(safeFields);
    const values    = Object.values(safeFields);
    const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');

    const query = `
      UPDATE action_items
      SET ${setClause}
      WHERE id = $${keys.length + 1}
      RETURNING *;
    `;

    const { rows } = await db.query(query, [...values, id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Action item not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating action item:', err);
    res.status(500).json({ error: 'Failed to update action item' });
  }
});

// ---------------------------------------------
// POST /api/action-items/:id/photos
// Multipart upload — field name: "photo"
// Multer saves to /data/uploads/ via uploadPhotos middleware.
// Stored URL: /files/:filename  (served by server.js static route)
// Appends to attachments jsonb — does NOT touch date_last_update.
// ---------------------------------------------
router.post('/:id/photos', uploadPhotos.single('photo'), async (req, res) => {
  try {
    const id = req.params.id;

    if (!req.file) {
      return res.status(400).json({ error: 'No photo file provided' });
    }

    const photoUrl = `/files/${req.file.filename}`;

    const attachment = {
      type: 'photo',
      url:  photoUrl,
      name: req.file.originalname,
      size: req.file.size,
    };

    // Append to jsonb array — no date_last_update (generated column)
    const query = `
      UPDATE action_items
      SET attachments = COALESCE(attachments, '[]'::jsonb) || $1::jsonb
      WHERE id = $2
      RETURNING *;
    `;

    const { rows } = await db.query(query, [JSON.stringify([attachment]), id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Action item not found' });

    res.json({ attachment, item: rows[0] });
  } catch (err) {
    console.error('Error uploading action item photo:', err);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

// ---------------------------------------------
// DELETE /api/action-items/:id/photos
// Body: { url: "/files/filename.jpg" }
// Removes matching entry from attachments jsonb array.
// Does NOT touch date_last_update (generated column).
// ---------------------------------------------
router.delete('/:id/photos', async (req, res) => {
  try {
    const id  = req.params.id;
    const url = req.body?.url;

    if (!url) return res.status(400).json({ error: 'url is required in request body' });

    const query = `
      UPDATE action_items
      SET attachments = (
        SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
        FROM   jsonb_array_elements(COALESCE(attachments, '[]'::jsonb)) AS elem
        WHERE  elem->>'url' <> $1
      )
      WHERE id = $2
      RETURNING *;
    `;

    const { rows } = await db.query(query, [url, id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Action item not found' });

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

    // Replace raw attachments blob with a readable photo count for Excel
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

// ─────────────────────────────────────────────────────────────────
// POST /api/action-items/batch-photos
// Batch upload photos to multiple action items.
// Each file should be named: {action_item_id}_{anything}.{ext}
// or the body field `mappings` JSON array: [{action_item_id, filename}]
// Accepts up to 100 photos via multipart field "photos"
// ─────────────────────────────────────────────────────────────────
router.post('/batch-photos', uploadPhotos.array('photos', 100), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No photos provided' });
    }

    const results = [];
    const errors  = [];

    for (const file of req.files) {
      // Extract action item ID from filename: expects prefix like "123_photo.jpg" or "123-photo.jpg"
      const match = file.originalname.match(/^(\d+)[_\-]/);
      if (!match) {
        errors.push({ filename: file.originalname, error: 'Filename must start with action item ID followed by _ or - (e.g. 123_photo.jpg)' });
        continue;
      }

      const actionItemId = parseInt(match[1], 10);

      // Verify action item exists
      const check = await db.query('SELECT id FROM action_items WHERE id = $1', [actionItemId]);
      if (!check.rows.length) {
        errors.push({ filename: file.originalname, action_item_id: actionItemId, error: `Action item ${actionItemId} not found` });
        continue;
      }

      const photoUrl = `/files/${file.filename}`;

      // Get existing attachments
      const existing = await db.query('SELECT attachments FROM action_items WHERE id = $1', [actionItemId]);
      let attachments = [];
      try { attachments = JSON.parse(existing.rows[0].attachments || '[]'); } catch { attachments = []; }

      attachments.push({ type: 'photo', url: photoUrl, name: file.originalname, size: file.size });

      await db.query(
        'UPDATE action_items SET attachments = $1, updated_at = NOW() WHERE id = $2',
        [JSON.stringify(attachments), actionItemId]
      );

      results.push({ filename: file.originalname, action_item_id: actionItemId, url: photoUrl });
    }

    res.json({ success: true, uploaded: results.length, errors: errors.length, results, errors });
  } catch (err) {
    console.error('Error in batch photo upload:', err);
    res.status(500).json({ error: 'Batch upload failed', details: err.message });
  }
});

module.exports = router;