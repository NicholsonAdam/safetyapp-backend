const express  = require('express');
const router   = express.Router();
const db       = require('../config/db');
const path     = require('path');
const fs       = require('fs');
const { uploadPhotos } = require('../middleware/upload');

// ─── PDF GENERATION ──────────────────────────────────────────────
// Uses pdfkit (npm install pdfkit)
// Falls back gracefully if not installed
let PDFDocument;
try { PDFDocument = require('pdfkit'); } catch (e) { PDFDocument = null; }

const GEMBA_QUESTIONS = [
  // ── SAFETY ──────────────────────────────────────────────────────
  { id: 'ppe_compliance',      section: 'Safety',              type: 'select',   label: 'PPE Compliance',                         options: ['Compliant','Minor Issues','Non-Compliant','N/A'] },
  { id: 'housekeeping',        section: 'Safety',              type: 'select',   label: 'Housekeeping & 5S Condition',            options: ['Excellent','Acceptable','Needs Attention','Unacceptable'] },
  { id: 'hazards_present',     section: 'Safety',              type: 'select',   label: 'Visible Hazards Present',               options: ['None','Minor','Moderate','Severe'] },
  { id: 'safety_signage',      section: 'Safety',              type: 'select',   label: 'Safety Signage & Labels',               options: ['All Present','Some Missing','Needs Update','Missing'] },
  { id: 'emergency_access',    section: 'Safety',              type: 'select',   label: 'Emergency Exits / Equipment Access',    options: ['Clear','Partially Blocked','Blocked'] },
  { id: 'safety_observations', section: 'Safety',              type: 'text',     label: 'Safety Observations & Concerns' },

  // ── QUALITY ─────────────────────────────────────────────────────
  { id: 'defect_visible',      section: 'Quality',             type: 'select',   label: 'Visible Defects / Rework',              options: ['None','Low','Moderate','High'] },
  { id: 'process_followed',    section: 'Quality',             type: 'select',   label: 'Standard Work / Process Being Followed',options: ['Yes','Mostly','Partially','No'] },
  { id: 'quality_controls',    section: 'Quality',             type: 'select',   label: 'Quality Controls in Place',             options: ['All Present','Some Missing','Not Present'] },
  { id: 'quality_observations',section: 'Quality',             type: 'text',     label: 'Quality Observations & Concerns' },

  // ── PRODUCTIVITY ─────────────────────────────────────────────────
  { id: 'line_running',        section: 'Productivity',        type: 'select',   label: 'Line / Equipment Running Status',       options: ['Running','Minor Downtime','Significant Downtime','Down'] },
  { id: 'staffing_level',      section: 'Productivity',        type: 'select',   label: 'Staffing Level vs Plan',               options: ['Fully Staffed','1 Short','2+ Short','Overstaffed'] },
  { id: 'bottleneck',          section: 'Productivity',        type: 'select',   label: 'Bottleneck / Constraint Visible',       options: ['None','Minor','Moderate','Significant'] },
  { id: 'productivity_notes',  section: 'Productivity',        type: 'text',     label: 'Productivity Observations & Notes' },

  // ── PEOPLE & ENGAGEMENT ──────────────────────────────────────────
  { id: 'employee_engagement', section: 'People & Engagement', type: 'select',   label: 'Employee Engagement Level',            options: ['High','Moderate','Low','Disengaged'] },
  { id: 'operator_feedback',   section: 'People & Engagement', type: 'text',     label: 'Operator / Team Member Feedback' },
  { id: 'training_adequate',   section: 'People & Engagement', type: 'select',   label: 'Training Appears Adequate',            options: ['Yes','Mostly','Needs Improvement','No'] },

  // ── EQUIPMENT & MAINTENANCE ──────────────────────────────────────
  { id: 'equipment_condition', section: 'Equipment',           type: 'select',   label: 'Equipment / Tooling Condition',        options: ['Good','Fair','Poor','Critical'] },
  { id: 'maintenance_issues',  section: 'Equipment',           type: 'text',     label: 'Maintenance Issues Observed' },
  { id: 'lubrication_clean',   section: 'Equipment',           type: 'select',   label: 'Lubrication / Cleaning Status',        options: ['Current','Overdue','Unknown'] },

  // ── MATERIAL FLOW ────────────────────────────────────────────────
  { id: 'material_flow',       section: 'Material Flow',       type: 'select',   label: 'Material Flow & Inventory Staging',    options: ['Optimal','Acceptable','Excess WIP','Shortage'] },
  { id: 'material_notes',      section: 'Material Flow',       type: 'text',     label: 'Material Flow Observations' },

  // ── OVERALL ──────────────────────────────────────────────────────
  { id: 'overall_rating',      section: 'Overall',             type: 'select',   label: 'Overall Area Rating',                  options: ['Excellent','Good','Fair','Poor'] },
  { id: 'action_required',     section: 'Overall',             type: 'select',   label: 'Immediate Action Required',            options: ['No','Yes - Minor','Yes - Moderate','Yes - Critical'] },
  { id: 'summary',             section: 'Overall',             type: 'text',     label: 'Summary & Recommendations' },
];

// Export questions so the frontend can import them
router.get('/questions', (req, res) => {
  res.json(GEMBA_QUESTIONS);
});

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
      LEFT JOIN employees e        ON e.employee_id = gs.created_by
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
// Create a new session and auto-join the creator
// ─────────────────────────────────────────────────────────────────
router.post('/sessions', async (req, res) => {
  try {
    const { name, department, area, created_by } = req.body;

    if (!name || !department || !area || !created_by) {
      return res.status(400).json({ error: 'name, department, area, and created_by are required' });
    }

    const { rows } = await db.query(`
      INSERT INTO gemba_sessions (name, department, area, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [name, department, area, created_by]);

    const session = rows[0];

    // Auto-join the creator
    await db.query(`
      INSERT INTO gemba_participants (session_id, employee_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
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

    // Check session exists and is open
    const { rows: s } = await db.query(
      `SELECT * FROM gemba_sessions WHERE id = $1`, [req.params.id]
    );
    if (!s.length) return res.status(404).json({ error: 'Session not found' });
    if (s[0].status !== 'OPEN') return res.status(400).json({ error: 'Session is closed' });

    await db.query(`
      INSERT INTO gemba_participants (session_id, employee_id)
      VALUES ($1, $2)
      ON CONFLICT (session_id, employee_id) DO NOTHING
    `, [req.params.id, employee_id]);

    res.json({ success: true });
  } catch (err) {
    console.error('Error joining gemba session:', err);
    res.status(500).json({ error: 'Failed to join session' });
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/gemba/sessions/:id/submit
// Submit answers for this participant
// Body: { employee_id, answers: { questionId: value, ... } }
// ─────────────────────────────────────────────────────────────────
router.post('/sessions/:id/submit', async (req, res) => {
  try {
    const { employee_id, answers } = req.body;
    if (!employee_id) return res.status(400).json({ error: 'employee_id is required' });

    const sessionId = req.params.id;

    // Upsert submission
    await db.query(`
      INSERT INTO gemba_submissions (session_id, employee_id, answers)
      VALUES ($1, $2, $3)
      ON CONFLICT (session_id, employee_id)
      DO UPDATE SET answers = $3, submitted_at = NOW()
    `, [sessionId, employee_id, JSON.stringify(answers)]);

    // Mark participant as submitted
    await db.query(`
      UPDATE gemba_participants
      SET submitted_at = NOW()
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
// Upload a photo for a submission
// Multipart field: "photo", body: { employee_id }
// ─────────────────────────────────────────────────────────────────
router.post('/sessions/:id/photos', uploadPhotos.single('photo'), async (req, res) => {
  try {
    const sessionId  = req.params.id;
    const employeeId = req.body.employee_id;

    if (!req.file)    return res.status(400).json({ error: 'No photo file provided' });
    if (!employeeId)  return res.status(400).json({ error: 'employee_id is required' });

    const photoUrl = `/files/${req.file.filename}`;
    const photo    = { url: photoUrl, name: req.file.originalname, size: req.file.size };

    // Append to submission photos array
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
// Close session, generate PDF, store in document library
// under Restricted Access > GEMBA subfolder
// ─────────────────────────────────────────────────────────────────
router.post('/sessions/:id/close', async (req, res) => {
  try {
    const sessionId = req.params.id;

    // Load session
    const { rows: sessions } = await db.query(
      `SELECT gs.*, e.name AS created_by_name
       FROM gemba_sessions gs
       LEFT JOIN employees e ON e.employee_id = gs.created_by
       WHERE gs.id = $1`, [sessionId]
    );
    if (!sessions.length) return res.status(404).json({ error: 'Session not found' });
    const session = sessions[0];
    if (session.status === 'CLOSED') return res.status(400).json({ error: 'Already closed' });

    // Load all participants with names
    const { rows: participants } = await db.query(`
      SELECT gp.*, e.name, e.department AS emp_dept
      FROM gemba_participants gp
      JOIN employees e ON e.employee_id = gp.employee_id
      WHERE gp.session_id = $1
      ORDER BY gp.joined_at
    `, [sessionId]);

    // Load all submissions
    const { rows: submissions } = await db.query(`
      SELECT gs.*, e.name AS submitter_name
      FROM gemba_submissions gs
      JOIN employees e ON e.employee_id = gs.employee_id
      WHERE gs.session_id = $1
      ORDER BY gs.submitted_at
    `, [sessionId]);

    // ── FIND OR CREATE GEMBA SUBFOLDER ──────────────────────────
    // Find "Restricted Access" top-level folder
    const { rows: restrictedFolders } = await db.query(
      `SELECT id FROM document_folders WHERE parent_folder_id IS NULL AND name ILIKE '%restricted%' LIMIT 1`
    );

    let gembaFolderId = null;

    if (restrictedFolders.length) {
      const restrictedId = restrictedFolders[0].id;

      // Find or create GEMBA subfolder
      const { rows: existing } = await db.query(
        `SELECT id FROM document_folders WHERE parent_folder_id = $1 AND name = 'GEMBA' LIMIT 1`,
        [restrictedId]
      );

      if (existing.length) {
        gembaFolderId = existing[0].id;
      } else {
        const { rows: created } = await db.query(
          `INSERT INTO document_folders (name, description, parent_folder_id, created_by)
           VALUES ('GEMBA', 'Leadership Gemba Walk Reports', $1, $2)
           RETURNING id`,
          [restrictedId, session.created_by]
        );
        gembaFolderId = created[0].id;
      }
    }

    // ── GENERATE PDF ─────────────────────────────────────────────
    const timestamp  = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const pdfName    = `GEMBA_${session.department}_${timestamp}.pdf`;
    const pdfDir     = '/data/documents';
    const pdfPath    = path.join(pdfDir, pdfName);

    if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });

    if (PDFDocument) {
      await new Promise((resolve, reject) => {
        const doc  = new PDFDocument({ margin: 50, size: 'A4' });
        const stream = fs.createWriteStream(pdfPath);
        doc.pipe(stream);

        const RED    = '#B30000';
        const DARK   = '#1a1a1a';
        const GRAY   = '#555555';
        const LIGHT  = '#f5f5f5';

        // ── HEADER ──
        doc.rect(0, 0, doc.page.width, 80).fill(DARK);
        doc.fillColor('white').fontSize(22).font('Helvetica-Bold')
           .text('LEADERSHIP GEMBA WALK REPORT', 50, 20);
        doc.fontSize(11).fillColor('#cccccc')
           .text(`${session.department}  ·  ${session.area}`, 50, 50);

        // Red accent line
        doc.rect(0, 80, doc.page.width, 4).fill(RED);

        doc.moveDown(2);

        // ── SESSION INFO ──
        doc.fillColor(DARK).fontSize(12).font('Helvetica-Bold').text('SESSION INFORMATION', { underline: false });
        doc.rect(50, doc.y, doc.page.width - 100, 1).fill(RED);
        doc.moveDown(0.5);

        const info = [
          ['Session Name',   session.name],
          ['Department',     session.department],
          ['Area',           session.area],
          ['Created By',     session.created_by_name || `ID: ${session.created_by}`],
          ['Created At',     new Date(session.created_at).toLocaleString()],
          ['Closed At',      new Date().toLocaleString()],
          ['Participants',   `${submissions.length} of ${participants.length} submitted`],
        ];

        info.forEach(([label, value]) => {
          doc.fontSize(10).font('Helvetica-Bold').fillColor(GRAY).text(`${label}: `, { continued: true });
          doc.font('Helvetica').fillColor(DARK).text(value || '—');
        });

        doc.moveDown(1);

        // ── PARTICIPANT LIST ──
        doc.fontSize(12).font('Helvetica-Bold').fillColor(DARK).text('PARTICIPANTS');
        doc.rect(50, doc.y, doc.page.width - 100, 1).fill(RED);
        doc.moveDown(0.5);

        participants.forEach(p => {
          const submitted = submissions.find(s => String(s.employee_id) === String(p.employee_id));
          const status = submitted ? '✓ Submitted' : '○ Not Submitted';
          const color  = submitted ? '#1a7a40' : '#B30000';
          doc.fontSize(10).font('Helvetica').fillColor(color)
             .text(`${status}  `, { continued: true })
             .fillColor(DARK).text(`${p.name}`);
        });

        doc.moveDown(1.5);

        // ── SUBMISSIONS ──
        const sections = [...new Set(GEMBA_QUESTIONS.map(q => q.section))];

        submissions.forEach((sub, si) => {
          if (doc.y > doc.page.height - 150) doc.addPage();

          // Submitter header
          doc.rect(50, doc.y, doc.page.width - 100, 28).fill(DARK);
          doc.fillColor('white').fontSize(12).font('Helvetica-Bold')
             .text(`  ${sub.submitter_name || `Employee ${sub.employee_id}`}`, 54, doc.y - 22);
          doc.fillColor('#aaa').fontSize(9)
             .text(`  Submitted: ${new Date(sub.submitted_at).toLocaleString()}`, 54, doc.y - 2);
          doc.moveDown(1);

          const answers = sub.answers || {};

          sections.forEach(section => {
            const sectionQs = GEMBA_QUESTIONS.filter(q => q.section === section);
            const hasAnswers = sectionQs.some(q => answers[q.id]);
            if (!hasAnswers) return;

            // Section subheader
            doc.fontSize(11).font('Helvetica-Bold').fillColor(RED).text(section.toUpperCase());
            doc.rect(50, doc.y, doc.page.width - 100, 0.5).fill('#dddddd');
            doc.moveDown(0.4);

            sectionQs.forEach(q => {
              const val = answers[q.id];
              if (!val) return;
              doc.fontSize(9).font('Helvetica-Bold').fillColor(GRAY)
                 .text(`${q.label}: `, { continued: true });
              doc.font('Helvetica').fillColor(DARK).text(val);
            });

            doc.moveDown(0.5);
          });

          // Photos
          if (sub.photos && sub.photos.length > 0) {
            doc.fontSize(10).font('Helvetica-Bold').fillColor(DARK)
               .text(`Photos: ${sub.photos.length} attached`);
            sub.photos.forEach((p, pi) => {
              const fullPath = path.join('/data/uploads', path.basename(p.url));
              if (fs.existsSync(fullPath)) {
                try {
                  if (doc.y > doc.page.height - 200) doc.addPage();
                  doc.image(fullPath, { width: 200, align: 'left' });
                  doc.fontSize(8).fillColor(GRAY).text(p.name || `Photo ${pi + 1}`);
                  doc.moveDown(0.5);
                } catch (imgErr) {
                  doc.fontSize(8).fillColor(GRAY).text(`[Photo: ${p.name}]`);
                }
              }
            });
          }

          doc.moveDown(1.5);
        });

        // ── FOOTER ──
        doc.rect(0, doc.page.height - 40, doc.page.width, 40).fill(DARK);
        doc.fillColor('#888').fontSize(8).font('Helvetica')
           .text(
             `Dal-Tile Muskogee  ·  GEMBA Walk Report  ·  Generated ${new Date().toLocaleString()}`,
             50, doc.page.height - 25, { align: 'center' }
           );

        doc.end();
        stream.on('finish', resolve);
        stream.on('error', reject);
      });
    } else {
      // Fallback: write a plain text file if pdfkit not installed
      const txt = [
        `GEMBA WALK REPORT`,
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

    // ── STORE IN DOCUMENT LIBRARY ────────────────────────────────
    let docId = null;
    if (gembaFolderId) {
      try {
        const { rows: docRows } = await db.query(`
          INSERT INTO documents (folder_id, title, description, created_by)
          VALUES ($1, $2, $3, $4)
          RETURNING id
        `, [
          gembaFolderId,
          `GEMBA Walk — ${session.department} — ${new Date().toLocaleDateString()}`,
          `${session.name} | ${session.area} | ${submissions.length}/${participants.length} submissions`,
          session.created_by,
        ]);

        docId = docRows[0].id;

        // Create version record pointing to the PDF
        await db.query(`
          INSERT INTO document_versions (document_id, version_number, file_path, file_type, uploaded_by, change_comment)
          VALUES ($1, 1, $2, 'application/pdf', $3, 'Auto-generated from GEMBA Walk session')
        `, [docId, `/data/documents/${pdfName}`, session.created_by]);
      } catch (docErr) {
        console.error('Error storing PDF in document library:', docErr);
        // Non-fatal — session still closes
      }
    }

    // ── CLOSE SESSION ────────────────────────────────────────────
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
// Get this participant's current submission (for resume/review)
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