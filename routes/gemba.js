const express  = require('express');
const router   = express.Router();
const db       = require('../config/db');
const path     = require('path');
const fs       = require('fs');
const { uploadPhotos } = require('../middleware/upload');

// ─── PDF GENERATION ──────────────────────────────────────────────
let PDFDocument;
try { PDFDocument = require('pdfkit'); } catch (e) { PDFDocument = null; }

// ─── Brand tokens (matches housekeeping inspection) ───────────────
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

const FONT = {
  regular: 'Helvetica',
  bold:    'Helvetica-Bold',
  oblique: 'Helvetica-Oblique',
};

const PAGE_W  = 612;
const PAGE_H  = 792;
const MARGIN  = 40;
const CONTENT = PAGE_W - MARGIN * 2;

// ─── Answer badge colours ─────────────────────────────────────────
const ANSWER_META = {
  'Compliant':          { color: COLOR.good,  bg: COLOR.goodBg  },
  'Excellent':          { color: COLOR.good,  bg: COLOR.goodBg  },
  'None':               { color: COLOR.good,  bg: COLOR.goodBg  },
  'All Present':        { color: COLOR.good,  bg: COLOR.goodBg  },
  'Clear':              { color: COLOR.good,  bg: COLOR.goodBg  },
  'Running':            { color: COLOR.good,  bg: COLOR.goodBg  },
  'Good':               { color: COLOR.good,  bg: COLOR.goodBg  },
  'High':               { color: COLOR.good,  bg: COLOR.goodBg  },
  'Yes':                { color: COLOR.good,  bg: COLOR.goodBg  },
  'Optimal':            { color: COLOR.good,  bg: COLOR.goodBg  },
  'Fully Staffed':      { color: COLOR.good,  bg: COLOR.goodBg  },
  'Current':            { color: COLOR.good,  bg: COLOR.goodBg  },
  'Minor Issues':       { color: COLOR.warn,  bg: COLOR.warnBg  },
  'Acceptable':         { color: COLOR.warn,  bg: COLOR.warnBg  },
  'Minor':              { color: COLOR.warn,  bg: COLOR.warnBg  },
  'Some Missing':       { color: COLOR.warn,  bg: COLOR.warnBg  },
  'Partially Blocked':  { color: COLOR.warn,  bg: COLOR.warnBg  },
  'Low':                { color: COLOR.warn,  bg: COLOR.warnBg  },
  'Fair':               { color: COLOR.warn,  bg: COLOR.warnBg  },
  'Moderate':           { color: COLOR.warn,  bg: COLOR.warnBg  },
  'Mostly':             { color: COLOR.warn,  bg: COLOR.warnBg  },
  'Overdue':            { color: COLOR.warn,  bg: COLOR.warnBg  },
  'Partially':          { color: COLOR.warn,  bg: COLOR.warnBg  },
  '1 Short':            { color: COLOR.warn,  bg: COLOR.warnBg  },
  'Yes - Minor':        { color: COLOR.warn,  bg: COLOR.warnBg  },
  'Non-Compliant':      { color: COLOR.issue, bg: COLOR.issueBg },
  'Needs Attention':    { color: COLOR.issue, bg: COLOR.issueBg },
  'Severe':             { color: COLOR.issue, bg: COLOR.issueBg },
  'Needs Update':       { color: COLOR.issue, bg: COLOR.issueBg },
  'Blocked':            { color: COLOR.issue, bg: COLOR.issueBg },
  'Not Present':        { color: COLOR.issue, bg: COLOR.issueBg },
  'Down':               { color: COLOR.issue, bg: COLOR.issueBg },
  '2+ Short':           { color: COLOR.issue, bg: COLOR.issueBg },
  'Poor':               { color: COLOR.issue, bg: COLOR.issueBg },
  'Disengaged':         { color: COLOR.issue, bg: COLOR.issueBg },
  'No':                 { color: COLOR.issue, bg: COLOR.issueBg },
  'Critical':           { color: COLOR.issue, bg: COLOR.issueBg },
  'Shortage':           { color: COLOR.issue, bg: COLOR.issueBg },
  'Yes - Moderate':     { color: COLOR.issue, bg: COLOR.issueBg },
  'Yes - Critical':     { color: COLOR.issue, bg: COLOR.issueBg },
};

const getAnswerMeta = val => ANSWER_META[val] || { color: COLOR.na, bg: COLOR.naBg };

// ─── Layout helpers ───────────────────────────────────────────────
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
    doc.addPage();
    drawHeader(doc, department, area);
    drawFooter(doc);
    y = 88;
  }
  doc.rect(MARGIN, y, CONTENT, BAR_H).fill(COLOR.red);
  doc.font(FONT.bold).fontSize(10).fillColor(COLOR.white)
     .text(title.toUpperCase(), MARGIN + 10, y + 7);
  doc.fillColor(COLOR.charcoal);
  return y + BAR_H + 8;
}

function answerRow(doc, question, value, y, department, area, rowIndex) {
  const ROW_H   = 22;
  const BADGE_W = 130;
  const Q_W     = CONTENT - BADGE_W - 12;

  if (y + ROW_H > PAGE_H - 60) {
    doc.addPage();
    drawHeader(doc, department, area);
    drawFooter(doc);
    y = 88;
  }

  const meta = getAnswerMeta(value);
  if (rowIndex % 2 === 0) doc.rect(MARGIN, y, CONTENT, ROW_H).fill(COLOR.lightGray);

  doc.font(FONT.regular).fontSize(9.5).fillColor(COLOR.charcoal)
     .text(question, MARGIN + 8, y + 5, { width: Q_W });

  const badgeX = MARGIN + Q_W + 12;
  doc.roundedRect(badgeX, y + 3, BADGE_W, 16, 3).fill(meta.bg);
  doc.font(FONT.bold).fontSize(8).fillColor(meta.color)
     .text(value, badgeX, y + 6, { width: BADGE_W, align: 'center' });

  return y + ROW_H;
}

function textRow(doc, question, value, y, department, area) {
  if (!value || !value.trim()) return y;

  const textH = Math.max(
    doc.heightOfString(value.trim(), { width: CONTENT - 20, font: FONT.regular, fontSize: 9.5 }) + 16,
    28
  );

  if (y + textH > PAGE_H - 60) {
    doc.addPage();
    drawHeader(doc, department, area);
    drawFooter(doc);
    y = 88;
  }

  doc.rect(MARGIN, y, CONTENT, textH).fill(COLOR.lightGray);
  doc.font(FONT.bold).fontSize(8).fillColor(COLOR.midGray)
     .text(question.toUpperCase(), MARGIN + 8, y + 5, { width: CONTENT - 16 });
  doc.font(FONT.regular).fontSize(9.5).fillColor(COLOR.charcoal)
     .text(value.trim(), MARGIN + 8, y + 15, { width: CONTENT - 16 });

  return y + textH + 4;
}

// ─── GEMBA QUESTIONS ─────────────────────────────────────────────
const GEMBA_QUESTIONS = [
  { id: 'ppe_compliance',      section: 'Safety',              type: 'select', label: 'PPE Compliance' },
  { id: 'housekeeping',        section: 'Safety',              type: 'select', label: 'Housekeeping & 5S Condition' },
  { id: 'hazards_present',     section: 'Safety',              type: 'select', label: 'Visible Hazards Present' },
  { id: 'safety_signage',      section: 'Safety',              type: 'select', label: 'Safety Signage & Labels' },
  { id: 'emergency_access',    section: 'Safety',              type: 'select', label: 'Emergency Exits / Equipment Access' },
  { id: 'safety_observations', section: 'Safety',              type: 'text',   label: 'Safety Observations & Concerns' },
  { id: 'defect_visible',      section: 'Quality',             type: 'select', label: 'Visible Defects / Rework' },
  { id: 'process_followed',    section: 'Quality',             type: 'select', label: 'Standard Work / Process Being Followed' },
  { id: 'quality_controls',    section: 'Quality',             type: 'select', label: 'Quality Controls in Place' },
  { id: 'quality_observations',section: 'Quality',             type: 'text',   label: 'Quality Observations & Concerns' },
  { id: 'line_running',        section: 'Productivity',        type: 'select', label: 'Line / Equipment Running Status' },
  { id: 'staffing_level',      section: 'Productivity',        type: 'select', label: 'Staffing Level vs Plan' },
  { id: 'bottleneck',          section: 'Productivity',        type: 'select', label: 'Bottleneck / Constraint Visible' },
  { id: 'productivity_notes',  section: 'Productivity',        type: 'text',   label: 'Productivity Observations & Notes' },
  { id: 'employee_engagement', section: 'People & Engagement', type: 'select', label: 'Employee Engagement Level' },
  { id: 'operator_feedback',   section: 'People & Engagement', type: 'text',   label: 'Operator / Team Member Feedback' },
  { id: 'training_adequate',   section: 'People & Engagement', type: 'select', label: 'Training Appears Adequate' },
  { id: 'equipment_condition', section: 'Equipment',           type: 'select', label: 'Equipment / Tooling Condition' },
  { id: 'maintenance_issues',  section: 'Equipment',           type: 'text',   label: 'Maintenance Issues Observed' },
  { id: 'lubrication_clean',   section: 'Equipment',           type: 'select', label: 'Lubrication / Cleaning Status' },
  { id: 'material_flow',       section: 'Material Flow',       type: 'select', label: 'Material Flow & Inventory Staging' },
  { id: 'material_notes',      section: 'Material Flow',       type: 'text',   label: 'Material Flow Observations' },
  { id: 'overall_rating',      section: 'Overall',             type: 'select', label: 'Overall Area Rating' },
  { id: 'action_required',     section: 'Overall',             type: 'select', label: 'Immediate Action Required' },
  { id: 'summary',             section: 'Overall',             type: 'text',   label: 'Summary & Recommendations' },
];

const SECTIONS = [...new Set(GEMBA_QUESTIONS.map(q => q.section))];

router.get('/questions', (req, res) => res.json(GEMBA_QUESTIONS));

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
          FILTER (WHERE gp.submitted_at IS NOT NULL)    AS submitted_count
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
        ) FILTER (WHERE gp.employee_id IS NOT NULL)     AS participants
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
// POST /api/gemba/sessions/:id/submit
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
// POST /api/gemba/sessions/:id/photos
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

    // ── FIND OR CREATE GEMBA SUBFOLDER ───────────────────────────
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

    // ── GENERATE PDF ─────────────────────────────────────────────
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

        // ── PAGE 1 ────────────────────────────────────────────────
        let y = drawHeader(doc, session.department, session.area);
        drawFooter(doc);

        // Status banner
        const anyIssues = submissions.some(sub =>
          Object.values(sub.answers || {}).some(v =>
            ['Non-Compliant','Severe','Blocked','Down','Critical','Yes - Critical','Yes - Moderate'].includes(v)
          )
        );
        const bannerColor = anyIssues ? COLOR.issue : COLOR.good;
        const bannerBg    = anyIssues ? COLOR.issueBg : COLOR.goodBg;
        const bannerLabel = anyIssues ? 'ACTION REQUIRED' : 'SESSION COMPLETE';

        doc.rect(MARGIN, y, CONTENT, 36).fill(bannerBg);
        doc.font(FONT.bold).fontSize(13).fillColor(bannerColor)
           .text(bannerLabel, MARGIN + 12, y + 10);

        const subLabel = `${submissions.length} of ${participants.length} submitted`;
        const subW = doc.widthOfString(subLabel, { fontSize: 8 }) + 16;
        const subX = PAGE_W - MARGIN - subW;
        doc.roundedRect(subX, y + 9, subW, 16, 3).fill(COLOR.naBg);
        doc.font(FONT.bold).fontSize(8).fillColor(COLOR.na)
           .text(subLabel, subX, y + 13, { width: subW, align: 'center' });

        y += 48;

        // Metadata grid — row 1
        doc.rect(MARGIN, y, CONTENT, 72).fill(COLOR.lightGray).stroke(COLOR.border);
        const col   = CONTENT / 4;
        const mY1   = y + 10;
        metaRow(doc, 'Session Name', session.name,                                      MARGIN + 10,           mY1, col - 10);
        metaRow(doc, 'Department',   session.department,                                MARGIN + 10 + col,     mY1, col - 10);
        metaRow(doc, 'Area',         session.area,                                      MARGIN + 10 + col * 2, mY1, col - 10);
        metaRow(doc, 'Created By',   session.created_by_name || session.created_by,    MARGIN + 10 + col * 3, mY1, col - 10);
        y += 84;

        // Metadata grid — row 2
        doc.rect(MARGIN, y, CONTENT, 52).fill(COLOR.lightGray).stroke(COLOR.border);
        const mY2 = y + 10;
        metaRow(doc, 'Created At', new Date(session.created_at).toLocaleString('en-US', { timeZone: 'America/Chicago', dateStyle: 'medium', timeStyle: 'short' }), MARGIN + 10,       mY2, col - 10);
        metaRow(doc, 'Closed At',  new Date().toLocaleString('en-US',               { timeZone: 'America/Chicago', dateStyle: 'medium', timeStyle: 'short' }), MARGIN + 10 + col, mY2, col - 10);
        y += 64;

        // ── PARTICIPANTS ──────────────────────────────────────────
        y = sectionBar(doc, 'Participants', y, session.department, session.area);

        participants.forEach((p, i) => {
          const submitted   = submissions.find(s => String(s.employee_id) === String(p.employee_id));
          const statusLabel = submitted ? '✓  Submitted' : '○  Not Submitted';
          const meta        = submitted
            ? { color: COLOR.good,  bg: COLOR.goodBg  }
            : { color: COLOR.issue, bg: COLOR.issueBg };
          const ROW_H = 22;

          if (y + ROW_H > PAGE_H - 60) {
            doc.addPage();
            drawHeader(doc, session.department, session.area);
            drawFooter(doc);
            y = 88;
          }

          if (i % 2 === 0) doc.rect(MARGIN, y, CONTENT, ROW_H).fill(COLOR.lightGray);

          doc.font(FONT.regular).fontSize(10).fillColor(COLOR.charcoal)
             .text(p.name, MARGIN + 8, y + 5, { width: CONTENT / 2 });

          const badgeW = 120;
          const badgeX = PAGE_W - MARGIN - badgeW;
          doc.roundedRect(badgeX, y + 3, badgeW, 16, 3).fill(meta.bg);
          doc.font(FONT.bold).fontSize(8).fillColor(meta.color)
             .text(statusLabel, badgeX, y + 6, { width: badgeW, align: 'center' });

          if (submitted) {
            doc.font(FONT.regular).fontSize(8).fillColor(COLOR.midGray)
               .text(
                 new Date(submitted.submitted_at).toLocaleString('en-US', { timeZone: 'America/Chicago', timeStyle: 'short', dateStyle: 'short' }),
                 MARGIN + CONTENT / 2, y + 6,
                 { width: CONTENT / 2 - badgeW - 16, align: 'right' }
               );
          }

          y += ROW_H;
        });

        y += 12;

        // ── SUBMISSIONS ───────────────────────────────────────────
        submissions.forEach(sub => {
          if (y + 40 > PAGE_H - 60) {
            doc.addPage();
            drawHeader(doc, session.department, session.area);
            drawFooter(doc);
            y = 88;
          }

          // Dark submitter bar
          doc.rect(MARGIN, y, CONTENT, 30).fill(COLOR.charcoal);
          doc.font(FONT.bold).fontSize(12).fillColor(COLOR.white)
             .text(sub.submitter_name || `Employee ${sub.employee_id}`, MARGIN + 10, y + 6);
          doc.font(FONT.regular).fontSize(8).fillColor('rgba(255,255,255,0.65)')
             .text(
               `Submitted: ${new Date(sub.submitted_at).toLocaleString('en-US', { timeZone: 'America/Chicago', dateStyle: 'medium', timeStyle: 'short' })}`,
               MARGIN + 10, y + 19
             );
          y += 38;

          const answers = sub.answers || {};

          SECTIONS.forEach(section => {
            const sectionQs  = GEMBA_QUESTIONS.filter(q => q.section === section);
            const hasAnswers = sectionQs.some(q => answers[q.id]);
            if (!hasAnswers) return;

            y = sectionBar(doc, section, y, session.department, session.area);

            let rowIndex = 0;
            sectionQs.forEach(q => {
              const val = answers[q.id];
              if (!val) return;
              if (q.type === 'select') {
                y = answerRow(doc, q.label, val, y, session.department, session.area, rowIndex);
                rowIndex++;
              } else {
                y = textRow(doc, q.label, val, y, session.department, session.area);
              }
            });

            y += 6;
          });

          // Photos
          if (sub.photos && sub.photos.length > 0) {
            y = sectionBar(doc, `Photos — ${sub.submitter_name}`, y, session.department, session.area);

            sub.photos.forEach((p, pi) => {
              const fullPath = path.join('/data/uploads', path.basename(p.url));
              if (!fs.existsSync(fullPath)) return;
              const PHOTO_H = 220;
              if (y + PHOTO_H + 20 > PAGE_H - 60) {
                doc.addPage();
                drawHeader(doc, session.department, session.area);
                drawFooter(doc);
                y = 88;
              }
              try {
                const maxW = 420;
                doc.image(fullPath, (PAGE_W - maxW) / 2, y, { fit: [maxW, PHOTO_H], align: 'center', valign: 'top' });
                doc.rect((PAGE_W - maxW) / 2, y, maxW, PHOTO_H).lineWidth(1).stroke(COLOR.border);
                doc.font(FONT.oblique).fontSize(8).fillColor(COLOR.midGray)
                   .text(p.name || `Photo ${pi + 1}`, MARGIN, y + PHOTO_H + 4, { align: 'center', width: CONTENT });
                y += PHOTO_H + 18;
              } catch (_) {
                doc.font(FONT.oblique).fontSize(9).fillColor(COLOR.midGray)
                   .text(`[Photo: ${p.name}]`, MARGIN, y + 4);
                y += 20;
              }
            });
          }

          y += 16;
        });

        doc.flushPages();
        doc.end();
        stream.on('finish', resolve);
        stream.on('error', reject);
      });
    } else {
      // Fallback plain text
      const txt = [
        'GEMBA WALK REPORT',
        `Session: ${session.name}`,
        `Department: ${session.department} | Area: ${session.area}`,
        `Created: ${session.created_at} | Closed: ${new Date().toISOString()}`,
        `Participants: ${participants.length} | Submissions: ${submissions.length}`,
        '',
        ...submissions.map(sub => [
          `--- ${sub.submitter_name} ---`,
          ...Object.entries(sub.answers || {}).map(([k, v]) => `  ${k}: ${v}`),
        ].join('\n')),
      ].join('\n');
      fs.writeFileSync(pdfPath.replace('.pdf', '.txt'), txt);
    }

    // ── STORE IN DOCUMENT LIBRARY ─────────────────────────────────
    let docId = null;
    if (gembaFolderId) {
      try {
        const { rows: docRows } = await db.query(`
          INSERT INTO documents (folder_id, title, description, created_by)
          VALUES ($1, $2, $3, $4) RETURNING id
        `, [
          gembaFolderId,
          `GEMBA Walk — ${session.department} — ${new Date().toLocaleDateString()}`,
          `${session.name} | ${session.area} | ${submissions.length}/${participants.length} submissions`,
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

    // ── CLOSE SESSION ─────────────────────────────────────────────
    await db.query(`
      UPDATE gemba_sessions
      SET status = 'CLOSED', closed_at = NOW(), pdf_path = $1, document_id = $2
      WHERE id = $3
    `, [pdfPath, docId, sessionId]);

    res.json({ success: true, pdf_path: pdfPath, document_id: docId });
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
