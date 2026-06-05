const express  = require('express');
const router   = express.Router();
const db       = require('../config/db');
const path     = require('path');
const fs       = require('fs');
const { uploadPhotos } = require('../middleware/upload');

let PDFDocument;
try { PDFDocument = require('pdfkit'); } catch (e) { PDFDocument = null; }

const COLOR = {
  red:       '#B30000',
  redDark:   '#7A0000',
  redLight:  '#FFE8E8',
  charcoal:  '#1A1A1A',
  midGray:   '#4A4A4A',
  lightGray: '#F4F4F4',
  border:    '#DDDDDD',
  white:     '#FFFFFF',
  good:      '#1A7A3F',
  goodBg:    '#E8F5EE',
  issue:     '#B30000',
  issueBg:   '#FFE8E8',
  warn:      '#B56000',
  warnBg:    '#FFF3E0',
  na:        '#5A5A5A',
  naBg:      '#F0F0F0',
};
const FONT   = { regular: 'Helvetica', bold: 'Helvetica-Bold', oblique: 'Helvetica-Oblique' };
const PAGE_W = 612, PAGE_H = 792, MARGIN = 40, CONTENT = PAGE_W - MARGIN * 2;

function drawHeader(doc, department, area) {
  doc.rect(0, 0, PAGE_W, 72).fill(COLOR.red);
  const LOGO_PATH = path.join(__dirname, '..', 'public', 'logo.jpg');
  let logoRight = MARGIN;
  try { doc.image(LOGO_PATH, MARGIN, 14, { height: 44 }); logoRight = MARGIN + 60; } catch (_) {}
  doc.fillColor(COLOR.white).font(FONT.bold).fontSize(15)
     .text('  DAL-TILE  ·  MUSKOGEE', logoRight + 12, 16, { lineBreak: false });
  doc.font(FONT.regular).fontSize(10).fillColor('rgba(255,255,255,0.80)')
     .text('  Leadership Gemba Walk Report', logoRight + 12, 36, { lineBreak: false });
  if (department) {
    const pillLabel = `${department}  ·  ${area || ''}`;
    const pillW = doc.widthOfString(pillLabel, { fontSize: 10 }) + 24;
    const pillX = PAGE_W - MARGIN - pillW;
    doc.roundedRect(pillX, 22, pillW, 26, 4).fill('rgba(0,0,0,0.25)');
    doc.font(FONT.bold).fontSize(10).fillColor(COLOR.white)
       .text(pillLabel, pillX, 31, { width: pillW, align: 'center', lineBreak: false });
  }
  doc.fillColor(COLOR.charcoal);
  return 84;
}

function drawFooter(doc) {
  const y = PAGE_H - 28;
  doc.moveTo(MARGIN, y - 4).lineTo(PAGE_W - MARGIN, y - 4).lineWidth(0.5).stroke(COLOR.border);
  doc.font(FONT.regular).fontSize(8).fillColor(COLOR.midGray)
     .text('Dal-Tile Safety App  ·  Muskogee Operations  ·  CONFIDENTIAL', MARGIN, y);
  doc.text(
    `Page ${doc.bufferedPageRange().start + doc.bufferedPageRange().count}`,
    0, y, { align: 'right', width: PAGE_W - MARGIN }
  );
  doc.fillColor(COLOR.charcoal);
}

function metaRow(doc, label, value, x, y, colW) {
  doc.font(FONT.bold).fontSize(8).fillColor(COLOR.midGray)
     .text(label.toUpperCase(), x, y, { width: colW });
  doc.font(FONT.regular).fontSize(10).fillColor(COLOR.charcoal)
     .text(value || '—', x, y + 10, { width: colW });
  return y + 28;
}

function sectionBar(doc, title, y, department, area) {
  const BAR_H = 24;
  if (y + BAR_H + 40 > PAGE_H - 60) {
    doc.addPage(); drawHeader(doc, department, area); drawFooter(doc); y = 88;
  }
  doc.rect(MARGIN, y, CONTENT, BAR_H).fill(COLOR.red);
  doc.font(FONT.bold).fontSize(10).fillColor(COLOR.white)
     .text(title.toUpperCase(), MARGIN + 10, y + 7);
  doc.fillColor(COLOR.charcoal);
  return y + BAR_H + 8;
}

// ─────────────────────────────────────────────────────────────────
// GET /api/gemba/sessions/open
// ─────────────────────────────────────────────────────────────────
router.get('/sessions/open', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        gs.*,
        e.name                                          AS created_by_name,
        COUNT(DISTINCT gp.employee_id)                  AS participant_count,
        COUNT(DISTINCT gp.employee_id)
          FILTER (WHERE gp.submitted_at IS NOT NULL)    AS submitted_count,
        (
          SELECT json_agg(gph_agg)
          FROM (
            SELECT filename, caption, action_item_requested, uploader_id,
                   uploaded_at, photo_number
            FROM gemba_walk_photos
            WHERE session_id = gs.id
            ORDER BY photo_number
          ) gph_agg
        )                                               AS walk_photos
      FROM gemba_sessions gs
      LEFT JOIN employees e           ON e.employee_id = gs.created_by
      LEFT JOIN gemba_participants gp ON gp.session_id = gs.id
      WHERE gs.status = 'OPEN'
      GROUP BY gs.id, e.name
      ORDER BY gs.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching open gemba sessions:', err);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/gemba/sessions/:id
// ─────────────────────────────────────────────────────────────────
router.get('/sessions/:id', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        gs.*,
        e.name                                          AS created_by_name,
        COUNT(DISTINCT gp.employee_id)                  AS participant_count,
        COUNT(DISTINCT gp.employee_id)
          FILTER (WHERE gp.submitted_at IS NOT NULL)    AS submitted_count,
        json_agg(
          json_build_object(
            'employee_id',  gp.employee_id,
            'name',         pe.name,
            'joined_at',    gp.joined_at,
            'submitted_at', gp.submitted_at
          )
        ) FILTER (WHERE gp.employee_id IS NOT NULL)     AS participants,
        (
          SELECT json_agg(gph_agg)
          FROM (
            SELECT filename, caption, action_item_requested, uploader_id,
                   uploaded_at, photo_number
            FROM gemba_walk_photos
            WHERE session_id = gs.id
            ORDER BY photo_number
          ) gph_agg
        )                                               AS walk_photos
      FROM gemba_sessions gs
      LEFT JOIN employees e           ON e.employee_id = gs.created_by
      LEFT JOIN gemba_participants gp ON gp.session_id = gs.id
      LEFT JOIN employees pe          ON pe.employee_id = gp.employee_id
      WHERE gs.id = $1
      GROUP BY gs.id, e.name
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Session not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching gemba session:', err);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/gemba/sessions
// ─────────────────────────────────────────────────────────────────
router.post('/sessions', async (req, res) => {
  try {
    const { name, department, area, created_by } = req.body;
    if (!name || !department || !area || !created_by) {
      return res.status(400).json({ error: 'name, department, area, and created_by are required' });
    }
    const { rows } = await db.query(`
      INSERT INTO gemba_sessions (name, department, area, created_by)
      VALUES ($1, $2, $3, $4) RETURNING *
    `, [name, department, area, created_by]);
    const session = rows[0];
    await db.query(`
      INSERT INTO gemba_participants (session_id, employee_id)
      VALUES ($1, $2) ON CONFLICT DO NOTHING
    `, [session.id, created_by]);
    res.json(session);
  } catch (err) {
    console.error('Error creating gemba session:', err);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/gemba/sessions/:id/join
// ─────────────────────────────────────────────────────────────────
router.post('/sessions/:id/join', async (req, res) => {
  try {
    const { employee_id } = req.body;
    if (!employee_id) return res.status(400).json({ error: 'employee_id is required' });
    const { rows: s } = await db.query(`SELECT * FROM gemba_sessions WHERE id = $1`, [req.params.id]);
    if (!s.length) return res.status(404).json({ error: 'Session not found' });
    if (s[0].status !== 'OPEN') return res.status(400).json({ error: 'Session is closed' });
    await db.query(`
      INSERT INTO gemba_participants (session_id, employee_id)
      VALUES ($1, $2) ON CONFLICT (session_id, employee_id) DO NOTHING
    `, [req.params.id, employee_id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error joining gemba session:', err);
    res.status(500).json({ error: 'Failed to join session' });
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/gemba/sessions/:id/walk-photo
// NEW — upload a single photo during the walk (before review/submit)
// Body (multipart): photo file + employee_id + caption (optional)
// ─────────────────────────────────────────────────────────────────
router.post('/sessions/:id/walk-photo', uploadPhotos.single('photo'), async (req, res) => {
  try {
    const sessionId  = req.params.id;
    const employeeId = req.body.employee_id;
    const caption    = req.body.caption || null;

    if (!req.file)   return res.status(400).json({ error: 'No photo file provided' });
    if (!employeeId) return res.status(400).json({ error: 'employee_id is required' });

    const { rows: s } = await db.query(`SELECT * FROM gemba_sessions WHERE id = $1`, [sessionId]);
    if (!s.length)              return res.status(404).json({ error: 'Session not found' });
    if (s[0].status !== 'OPEN') return res.status(400).json({ error: 'Session is not open' });

    // Get next photo number for this session
    const { rows: countRows } = await db.query(
      `SELECT COALESCE(MAX(photo_number), 0) + 1 AS next_num FROM gemba_walk_photos WHERE session_id = $1`,
      [sessionId]
    );
    const photoNumber = countRows[0].next_num;

    const { rows: photoRows } = await db.query(`
      INSERT INTO gemba_walk_photos
        (session_id, filename, caption, uploader_id, photo_number)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [sessionId, req.file.filename, caption, employeeId, photoNumber]);

    res.json({
      photo: photoRows[0],
      url: `/files/${req.file.filename}`,
    });
  } catch (err) {
    console.error('Error uploading walk photo:', err);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/gemba/sessions/:id/walk-photos
// Returns all walk photos for review before submission
// ─────────────────────────────────────────────────────────────────
router.get('/sessions/:id/walk-photos', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT gp.*, e.name AS uploader_name
      FROM gemba_walk_photos gp
      LEFT JOIN employees e ON e.employee_id = gp.uploader_id
      WHERE gp.session_id = $1
      ORDER BY gp.photo_number
    `, [req.params.id]);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching walk photos:', err);
    res.status(500).json({ error: 'Failed to fetch photos' });
  }
});

// ─────────────────────────────────────────────────────────────────
// PATCH /api/gemba/walk-photos/:photoId
// Update a single walk photo: include_in_submission, caption,
// action_item_requested, action_item_description
// ─────────────────────────────────────────────────────────────────
router.patch('/walk-photos/:photoId', async (req, res) => {
  try {
    const { include_in_submission, caption, action_item_requested, action_item_description } = req.body;
    const { rows } = await db.query(`
      UPDATE gemba_walk_photos
      SET
        include_in_submission  = COALESCE($1, include_in_submission),
        caption                = COALESCE($2, caption),
        action_item_requested  = COALESCE($3, action_item_requested),
        action_item_description= COALESCE($4, action_item_description)
      WHERE id = $5
      RETURNING *
    `, [
      include_in_submission !== undefined ? include_in_submission : null,
      caption       !== undefined ? caption       : null,
      action_item_requested !== undefined ? action_item_requested : null,
      action_item_description !== undefined ? action_item_description : null,
      req.params.photoId,
    ]);
    if (!rows.length) return res.status(404).json({ error: 'Photo not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating walk photo:', err);
    res.status(500).json({ error: 'Failed to update photo' });
  }
});

// ─────────────────────────────────────────────────────────────────
// DELETE /api/gemba/walk-photos/:photoId
// Remove a walk photo from the session
// ─────────────────────────────────────────────────────────────────
router.delete('/walk-photos/:photoId', async (req, res) => {
  try {
    const { rows } = await db.query(
      `DELETE FROM gemba_walk_photos WHERE id = $1 RETURNING filename`,
      [req.params.photoId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Photo not found' });
    // Optionally clean file from disk
    try {
      const fp = path.join('/data/uploads', rows[0].filename);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    } catch (_) {}
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting walk photo:', err);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/gemba/sessions/:id/submit  (unchanged — per-participant answers)
// ─────────────────────────────────────────────────────────────────
router.post('/sessions/:id/submit', async (req, res) => {
  try {
    const { employee_id, answers } = req.body;
    if (!employee_id) return res.status(400).json({ error: 'employee_id is required' });
    const sessionId = req.params.id;
    await db.query(`
      INSERT INTO gemba_submissions (session_id, employee_id, answers)
      VALUES ($1, $2, $3)
      ON CONFLICT (session_id, employee_id)
      DO UPDATE SET answers = $3, submitted_at = NOW()
    `, [sessionId, employee_id, JSON.stringify(answers)]);
    await db.query(`
      UPDATE gemba_participants SET submitted_at = NOW()
      WHERE session_id = $1 AND employee_id = $2
    `, [sessionId, employee_id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error submitting gemba answers:', err);
    res.status(500).json({ error: 'Failed to submit' });
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/gemba/sessions/:id/photos  (legacy per-participant photos)
// Kept for backwards compat
// ─────────────────────────────────────────────────────────────────
router.post('/sessions/:id/photos', uploadPhotos.single('photo'), async (req, res) => {
  try {
    const sessionId  = req.params.id;
    const employeeId = req.body.employee_id;
    if (!req.file)   return res.status(400).json({ error: 'No photo file provided' });
    if (!employeeId) return res.status(400).json({ error: 'employee_id is required' });
    const photoUrl = `/files/${req.file.filename}`;
    const photo    = { url: photoUrl, name: req.file.originalname, size: req.file.size };
    await db.query(`
      INSERT INTO gemba_submissions (session_id, employee_id, photos)
      VALUES ($1, $2, $3::jsonb)
      ON CONFLICT (session_id, employee_id)
      DO UPDATE SET photos = gemba_submissions.photos || $3::jsonb
    `, [sessionId, employeeId, JSON.stringify([photo])]);
    res.json({ photo });
  } catch (err) {
    console.error('Error uploading gemba photo:', err);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/gemba/sessions/:id/close
// Generates PDF now including walk photos with their action-item flags
// ─────────────────────────────────────────────────────────────────
router.post('/sessions/:id/close', async (req, res) => {
  try {
    const sessionId = req.params.id;

    const { rows: sessions } = await db.query(`
      SELECT gs.*, e.name AS created_by_name
      FROM gemba_sessions gs
      LEFT JOIN employees e ON e.employee_id = gs.created_by
      WHERE gs.id = $1
    `, [sessionId]);
    if (!sessions.length) return res.status(404).json({ error: 'Session not found' });
    const session = sessions[0];
    if (session.status === 'CLOSED') return res.status(400).json({ error: 'Already closed' });

    const { rows: participants } = await db.query(`
      SELECT gp.*, e.name, e.department AS emp_dept
      FROM gemba_participants gp
      JOIN employees e ON e.employee_id = gp.employee_id
      WHERE gp.session_id = $1 ORDER BY gp.joined_at
    `, [sessionId]);

    const { rows: submissions } = await db.query(`
      SELECT gs.*, e.name AS submitter_name
      FROM gemba_submissions gs
      JOIN employees e ON e.employee_id = gs.employee_id
      WHERE gs.session_id = $1 ORDER BY gs.submitted_at
    `, [sessionId]);

    // Walk photos (only those flagged include_in_submission = true, or not yet reviewed = default include)
    const { rows: walkPhotos } = await db.query(`
      SELECT gp.*, e.name AS uploader_name
      FROM gemba_walk_photos gp
      LEFT JOIN employees e ON e.employee_id = gp.uploader_id
      WHERE gp.session_id = $1
        AND (gp.include_in_submission IS NULL OR gp.include_in_submission = true)
      ORDER BY gp.photo_number
    `, [sessionId]);

    // Action items requested from photos
    const actionItemPhotos = walkPhotos.filter(p => p.action_item_requested === true);

    // Find/create GEMBA folder
    const { rows: restrictedFolders } = await db.query(
      `SELECT id FROM document_folders WHERE parent_folder_id IS NULL AND name ILIKE '%restricted%' LIMIT 1`
    );
    let gembaFolderId = null;
    if (restrictedFolders.length) {
      const restrictedId = restrictedFolders[0].id;
      const { rows: existing } = await db.query(
        `SELECT id FROM document_folders WHERE parent_folder_id = $1 AND name = 'GEMBA' LIMIT 1`,
        [restrictedId]
      );
      if (existing.length) {
        gembaFolderId = existing[0].id;
      } else {
        const { rows: created } = await db.query(
          `INSERT INTO document_folders (name, description, parent_folder_id, created_by)
           VALUES ('GEMBA', 'Leadership Gemba Walk Reports', $1, $2) RETURNING id`,
          [restrictedId, session.created_by]
        );
        gembaFolderId = created[0].id;
      }
    }

    // Generate PDF
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const pdfName   = `GEMBA_${session.department}_${timestamp}.pdf`;
    const pdfDir    = '/data/documents';
    const pdfPath   = path.join(pdfDir, pdfName);
    if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });

    if (PDFDocument) {
      await new Promise((resolve, reject) => {
        const doc = new PDFDocument({
          size: 'LETTER',
          margins: { top: 0, right: 0, bottom: 0, left: 0 },
          autoFirstPage: true,
          bufferPages: true,
          info: {
            Title:   `Gemba Walk – ${session.department} – ${session.area}`,
            Author:  session.created_by_name || 'Dal-Tile',
            Subject: 'Leadership Gemba Walk Report',
            Creator: 'Dal-Tile Safety App',
          },
        });

        const stream = fs.createWriteStream(pdfPath);
        doc.pipe(stream);

        let y = drawHeader(doc, session.department, session.area);
        drawFooter(doc);

        // Status banner
        doc.rect(MARGIN, y, CONTENT, 36).fill(COLOR.goodBg);
        doc.font(FONT.bold).fontSize(13).fillColor(COLOR.good)
           .text('SESSION COMPLETE', MARGIN + 12, y + 10);
        const subLabel = `${submissions.length} of ${participants.length} submitted  ·  ${walkPhotos.length} photos`;
        const subW = doc.widthOfString(subLabel, { fontSize: 8 }) + 16;
        const subX = PAGE_W - MARGIN - subW;
        doc.roundedRect(subX, y + 9, subW, 16, 3).fill(COLOR.naBg);
        doc.font(FONT.bold).fontSize(8).fillColor(COLOR.na)
           .text(subLabel, subX, y + 13, { width: subW, align: 'center' });
        y += 48;

        // Metadata grid
        doc.rect(MARGIN, y, CONTENT, 72).fill(COLOR.lightGray).stroke(COLOR.border);
        const col  = CONTENT / 4;
        const mY1  = y + 10;
        metaRow(doc, 'Session Name', session.name,                                     MARGIN + 10,           mY1, col - 10);
        metaRow(doc, 'Department',   session.department,                               MARGIN + 10 + col,     mY1, col - 10);
        metaRow(doc, 'Area',         session.area,                                     MARGIN + 10 + col * 2, mY1, col - 10);
        metaRow(doc, 'Created By',   session.created_by_name || session.created_by,   MARGIN + 10 + col * 3, mY1, col - 10);
        y += 84;

        doc.rect(MARGIN, y, CONTENT, 52).fill(COLOR.lightGray).stroke(COLOR.border);
        const mY2 = y + 10;
        metaRow(doc, 'Created At', new Date(session.created_at).toLocaleString('en-US', { timeZone: 'America/Chicago', dateStyle: 'medium', timeStyle: 'short' }), MARGIN + 10,       mY2, col - 10);
        metaRow(doc, 'Closed At',  new Date().toLocaleString('en-US',               { timeZone: 'America/Chicago', dateStyle: 'medium', timeStyle: 'short' }), MARGIN + 10 + col, mY2, col - 10);
        y += 64;

        // Participants
        y = sectionBar(doc, 'Participants', y, session.department, session.area);
        participants.forEach((p, i) => {
          const submitted   = submissions.find(s => String(s.employee_id) === String(p.employee_id));
          const statusLabel = submitted ? '✓  Submitted' : '○  Not Submitted';
          const meta        = submitted ? { color: COLOR.good, bg: COLOR.goodBg } : { color: COLOR.issue, bg: COLOR.issueBg };
          const ROW_H = 22;
          if (y + ROW_H > PAGE_H - 60) { doc.addPage(); drawHeader(doc, session.department, session.area); drawFooter(doc); y = 88; }
          if (i % 2 === 0) doc.rect(MARGIN, y, CONTENT, ROW_H).fill(COLOR.lightGray);
          doc.font(FONT.regular).fontSize(10).fillColor(COLOR.charcoal)
             .text(p.name, MARGIN + 8, y + 5, { width: CONTENT / 2 });
          const badgeW = 120, badgeX = PAGE_W - MARGIN - badgeW;
          doc.roundedRect(badgeX, y + 3, badgeW, 16, 3).fill(meta.bg);
          doc.font(FONT.bold).fontSize(8).fillColor(meta.color)
             .text(statusLabel, badgeX, y + 6, { width: badgeW, align: 'center' });
          y += ROW_H;
        });
        y += 12;

        // Walk Photos section
        if (walkPhotos.length > 0) {
          y = sectionBar(doc, `Walk Photos (${walkPhotos.length} included in report)`, y, session.department, session.area);

          walkPhotos.forEach((p, pi) => {
            const fullPath = path.join('/data/uploads', p.filename);
            const PHOTO_H  = 200;
            const INFO_H   = p.action_item_requested ? 52 : 28;
            if (y + PHOTO_H + INFO_H + 10 > PAGE_H - 60) {
              doc.addPage(); drawHeader(doc, session.department, session.area); drawFooter(doc); y = 88;
            }

            // Photo label bar
            const labelBg = p.action_item_requested ? COLOR.warnBg : COLOR.lightGray;
            const labelFg = p.action_item_requested ? COLOR.warn   : COLOR.midGray;
            doc.rect(MARGIN, y, CONTENT, 20).fill(labelBg);
            doc.font(FONT.bold).fontSize(9).fillColor(labelFg)
               .text(
                 `Photo ${p.photo_number}${p.caption ? '  ·  ' + p.caption : ''}${p.uploader_name ? '  ·  ' + p.uploader_name : ''}`,
                 MARGIN + 8, y + 5, { width: CONTENT - 16 }
               );
            if (p.action_item_requested) {
              doc.font(FONT.bold).fontSize(8).fillColor(COLOR.warn)
                 .text('⚠  ACTION ITEM REQUESTED', PAGE_W - MARGIN - 160, y + 5);
            }
            y += 22;

            // Photo image
            if (fs.existsSync(fullPath)) {
              try {
                const maxW = 420;
                doc.image(fullPath, (PAGE_W - maxW) / 2, y, { fit: [maxW, PHOTO_H], align: 'center', valign: 'top' });
                doc.rect((PAGE_W - maxW) / 2, y, maxW, PHOTO_H).lineWidth(0.5).stroke(COLOR.border);
              } catch (_) {
                doc.font(FONT.oblique).fontSize(9).fillColor(COLOR.midGray)
                   .text(`[Photo not available: ${p.filename}]`, MARGIN, y + 8);
              }
            }
            y += PHOTO_H + 6;

            // Action item description if present
            if (p.action_item_requested && p.action_item_description) {
              doc.rect(MARGIN, y, CONTENT, 28).fill(COLOR.warnBg);
              doc.font(FONT.bold).fontSize(8).fillColor(COLOR.warn)
                 .text('ACTION ITEM:', MARGIN + 8, y + 5);
              doc.font(FONT.regular).fontSize(9).fillColor(COLOR.warn)
                 .text(p.action_item_description, MARGIN + 90, y + 5, { width: CONTENT - 100 });
              y += 32;
            }

            y += 10;
          });
        }

        // Action items summary
        if (actionItemPhotos.length > 0) {
          if (y + 60 > PAGE_H - 60) { doc.addPage(); drawHeader(doc, session.department, session.area); drawFooter(doc); y = 88; }
          y = sectionBar(doc, `Action Items Summary (${actionItemPhotos.length})`, y, session.department, session.area);
          actionItemPhotos.forEach((p, i) => {
            const ROW_H = p.action_item_description ? 36 : 22;
            if (y + ROW_H > PAGE_H - 60) { doc.addPage(); drawHeader(doc, session.department, session.area); drawFooter(doc); y = 88; }
            if (i % 2 === 0) doc.rect(MARGIN, y, CONTENT, ROW_H).fill(COLOR.warnBg);
            doc.font(FONT.bold).fontSize(9).fillColor(COLOR.warn)
               .text(`Photo ${p.photo_number}`, MARGIN + 8, y + 5);
            if (p.action_item_description) {
              doc.font(FONT.regular).fontSize(9).fillColor(COLOR.charcoal)
                 .text(p.action_item_description, MARGIN + 80, y + 5, { width: CONTENT - 90 });
            }
            y += ROW_H;
          });
          y += 12;
        }

        // Per-participant form submissions
        submissions.forEach(sub => {
          if (y + 40 > PAGE_H - 60) { doc.addPage(); drawHeader(doc, session.department, session.area); drawFooter(doc); y = 88; }
          doc.rect(MARGIN, y, CONTENT, 30).fill(COLOR.charcoal);
          doc.font(FONT.bold).fontSize(12).fillColor(COLOR.white)
             .text(sub.submitter_name || `Employee ${sub.employee_id}`, MARGIN + 10, y + 6);
          doc.font(FONT.regular).fontSize(8).fillColor('rgba(255,255,255,0.65)')
             .text(`Submitted: ${new Date(sub.submitted_at).toLocaleString('en-US', { timeZone: 'America/Chicago', dateStyle: 'medium', timeStyle: 'short' })}`, MARGIN + 10, y + 19);
          y += 38;

          const answers = sub.answers || {};
          if (Object.keys(answers).length === 0) {
            doc.font(FONT.oblique).fontSize(9).fillColor(COLOR.midGray)
               .text('No answers recorded.', MARGIN + 8, y + 4);
            y += 20;
          } else {
            Object.entries(answers).forEach(([key, val]) => {
              if (!val || y + 22 > PAGE_H - 60) {
                if (y + 22 > PAGE_H - 60) { doc.addPage(); drawHeader(doc, session.department, session.area); drawFooter(doc); y = 88; }
                return;
              }
              doc.rect(MARGIN, y, CONTENT, 22).fill(COLOR.lightGray);
              doc.font(FONT.regular).fontSize(9).fillColor(COLOR.midGray)
                 .text(key.replace(/_/g, ' '), MARGIN + 8, y + 5, { width: CONTENT / 2 });
              doc.font(FONT.bold).fontSize(9).fillColor(COLOR.charcoal)
                 .text(String(val), MARGIN + CONTENT / 2 + 8, y + 5, { width: CONTENT / 2 - 16 });
              y += 22;
            });
          }
          y += 16;
        });

        doc.flushPages();
        doc.end();
        stream.on('finish', resolve);
        stream.on('error', reject);
      });
    }

    // Store PDF in document library
    let docId = null;
    if (gembaFolderId) {
      try {
        const { rows: docRows } = await db.query(`
          INSERT INTO documents (folder_id, title, description, created_by)
          VALUES ($1, $2, $3, $4) RETURNING id
        `, [
          gembaFolderId,
          `GEMBA Walk — ${session.department} — ${new Date().toLocaleDateString()}`,
          `${session.name} | ${session.area} | ${submissions.length}/${participants.length} submissions | ${walkPhotos.length} photos`,
          session.created_by,
        ]);
        docId = docRows[0].id;
        await db.query(`
          INSERT INTO document_versions (document_id, version_number, file_path, file_type, uploaded_by, change_comment)
          VALUES ($1, 1, $2, 'application/pdf', $3, 'Auto-generated from GEMBA Walk session')
        `, [docId, `/data/documents/${pdfName}`, session.created_by]);
      } catch (docErr) {
        console.error('Error storing PDF in document library:', docErr);
      }
    }

    // Create action items in the action_items table for photos that requested them
    for (const p of actionItemPhotos) {
      try {
        await db.query(`
          INSERT INTO action_items
            (title, description, source_type, source_id, photo_url, created_by, status)
          VALUES ($1, $2, 'GEMBA_WALK', $3, $4, $5, 'Open')
          ON CONFLICT DO NOTHING
        `, [
          `Gemba Walk Action Item — Photo ${p.photo_number}`,
          p.action_item_description || `Action item from Gemba Walk photo ${p.photo_number}`,
          sessionId,
          `/files/${p.filename}`,
          session.created_by,
        ]);
      } catch (aiErr) {
        console.error('Error creating action item for photo:', aiErr);
      }
    }

    await db.query(`
      UPDATE gemba_sessions
      SET status = 'CLOSED', closed_at = NOW(), pdf_path = $1, document_id = $2
      WHERE id = $3
    `, [pdfPath, docId, sessionId]);

    res.json({
      success: true,
      pdf_path: pdfPath,
      document_id: docId,
      action_items_created: actionItemPhotos.length,
    });
  } catch (err) {
    console.error('Error closing gemba session:', err);
    res.status(500).json({ error: 'Failed to close session' });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/gemba/sessions/:id/submission/:employeeId
// ─────────────────────────────────────────────────────────────────
router.get('/sessions/:id/submission/:employeeId', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT * FROM gemba_submissions
      WHERE session_id = $1 AND employee_id = $2
    `, [req.params.id, req.params.employeeId]);
    res.json(rows[0] || null);
  } catch (err) {
    console.error('Error fetching submission:', err);
    res.status(500).json({ error: 'Failed to fetch submission' });
  }
});

module.exports = router;