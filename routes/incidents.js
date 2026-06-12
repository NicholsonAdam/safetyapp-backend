const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const path    = require('path');
const fs      = require('fs');
const { uploadPhotos } = require('../middleware/upload');

let PDFDocument;
try { PDFDocument = require('pdfkit'); } catch (e) { PDFDocument = null; }

const COLOR = {
  red:       '#B30000',
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

function drawHeader(doc, title) {
  doc.rect(0, 0, PAGE_W, 72).fill(COLOR.red);
  const LOGO_PATH = path.join(__dirname, '..', 'public', 'logo.jpg');
  let logoRight = MARGIN;
  try { doc.image(LOGO_PATH, MARGIN, 14, { height: 44 }); logoRight = MARGIN + 60; } catch (_) {}
  doc.fillColor(COLOR.white).font(FONT.bold).fontSize(15)
     .text('  DAL-TILE  ·  MUSKOGEE', logoRight + 12, 16, { lineBreak: false });
  doc.font(FONT.regular).fontSize(10).fillColor('rgba(255,255,255,0.80)')
     .text(`  ${title}`, logoRight + 12, 36, { lineBreak: false });
  doc.fillColor(COLOR.charcoal);
  return 84;
}

function drawFooter(doc) {
  const y = PAGE_H - 28;
  doc.moveTo(MARGIN, y - 4).lineTo(PAGE_W - MARGIN, y - 4).lineWidth(0.5).stroke(COLOR.border);
  doc.font(FONT.regular).fontSize(8).fillColor(COLOR.midGray)
     .text('Dal-Tile Safety App  ·  Muskogee Operations  ·  CONFIDENTIAL', MARGIN, y);
  doc.text(`Page ${doc.bufferedPageRange().start + doc.bufferedPageRange().count}`,
    0, y, { align: 'right', width: PAGE_W - MARGIN });
  doc.fillColor(COLOR.charcoal);
}

function sectionBar(doc, title, y) {
  const BAR_H = 24;
  if (y + BAR_H + 40 > PAGE_H - 60) {
    doc.addPage();
    y = drawHeader(doc, 'Incident Investigation Report');
    drawFooter(doc);
    y = 88;
  }
  doc.rect(MARGIN, y, CONTENT, BAR_H).fill(COLOR.red);
  doc.font(FONT.bold).fontSize(10).fillColor(COLOR.white).text(title.toUpperCase(), MARGIN + 10, y + 7);
  doc.fillColor(COLOR.charcoal);
  return y + BAR_H + 8;
}

function metaRow(doc, label, value, x, y, colW) {
  doc.font(FONT.bold).fontSize(8).fillColor(COLOR.midGray).text(label.toUpperCase(), x, y, { width: colW });
  doc.font(FONT.regular).fontSize(10).fillColor(COLOR.charcoal).text(value || '—', x, y + 10, { width: colW });
  return y + 28;
}

function fieldBlock(doc, label, value, y) {
  if (!value || !String(value).trim()) return y;
  const textH = Math.max(
    doc.heightOfString(String(value).trim(), { width: CONTENT - 20, fontSize: 10 }) + 24, 36
  );
  if (y + textH > PAGE_H - 60) { doc.addPage(); y = drawHeader(doc, 'Incident Investigation Report'); drawFooter(doc); y = 88; }
  doc.rect(MARGIN, y, CONTENT, textH).fill(COLOR.lightGray);
  doc.font(FONT.bold).fontSize(8).fillColor(COLOR.midGray).text(label.toUpperCase(), MARGIN + 8, y + 6, { width: CONTENT - 16 });
  doc.font(FONT.regular).fontSize(10).fillColor(COLOR.charcoal).text(String(value).trim(), MARGIN + 8, y + 18, { width: CONTENT - 16 });
  return y + textH + 6;
}

// ─────────────────────────────────────────────────────────────────
// GET /api/incidents — list all
// ─────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { status, department, search, sort = 'id', direction = 'desc' } = req.query;
    let query = 'SELECT id,employee_name,employee_number,department,position_title,incident_date,report_date,status,submitted_by,created_at,investigator_name,delay_reason FROM incident_investigations WHERE 1=1';
    const params = [];
    if (status)     { params.push(status);        query += ` AND status = $${params.length}`; }
    if (department) { params.push(department);    query += ` AND department = $${params.length}`; }
    if (search)     { params.push(`%${search}%`); query += ` AND (employee_name ILIKE $${params.length} OR description_of_incident ILIKE $${params.length})`; }
    const allowed = ['id','employee_name','department','incident_date','status','created_at'];
    const safeSort = allowed.includes(sort) ? sort : 'id';
    const safeDir  = direction === 'asc' ? 'asc' : 'desc';
    query += ` ORDER BY ${safeSort} ${safeDir}`;
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching incidents:', err);
    res.status(500).json({ error: 'Failed to fetch incidents' });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/incidents/employee-lookup/:employeeId
// Returns employee info + leader info for the incident form
// ─────────────────────────────────────────────────────────────────
router.get('/employee-lookup/:employeeId', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT e.employee_id, e.name, e.department, e.job_title, e.shift, e.leader_id,
              l.name AS leader_name
       FROM employees e
       LEFT JOIN employees l ON l.employee_id = e.leader_id
       WHERE e.employee_id = $1`,
      [req.params.employeeId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Employee not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error looking up employee for incident:', err);
    res.status(500).json({ error: 'Lookup failed' });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/incidents/open  — must be before /:id
// Returns all OPEN/IN_PROGRESS investigations
// ─────────────────────────────────────────────────────────────────
router.get('/open', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT id, employee_name, department, incident_date, report_date,
             status, created_at, investigator_name, supervisor
      FROM incident_investigations
      WHERE status IN ('OPEN','IN_PROGRESS')
      ORDER BY created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching open incidents:', err);
    res.status(500).json({ error: 'Failed to fetch open incidents' });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/incidents/:id/full  — must be before /:id
// Returns full investigation record for editing/joining
// ─────────────────────────────────────────────────────────────────
router.get('/:id/full', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM incident_investigations WHERE id = $1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const record = rows[0];
    if (typeof record.incident_types === 'string') {
      try { record.incident_types = JSON.parse(record.incident_types); } catch { record.incident_types = []; }
    }
    if (typeof record.photos === 'string') {
      try { record.photos = JSON.parse(record.photos); } catch { record.photos = []; }
    }
    res.json(record);
  } catch (err) {
    console.error('Error fetching incident full:', err);
    res.status(500).json({ error: 'Failed to fetch incident' });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/incidents/:id
// ─────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM incident_investigations WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching incident:', err);
    res.status(500).json({ error: 'Failed to fetch incident' });
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/incidents/photos — upload photo before submit
// ─────────────────────────────────────────────────────────────────
router.post('/photos', uploadPhotos.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });
    const url = `/files/${req.file.filename}`;
    res.json({ url, name: req.file.originalname, size: req.file.size });
  } catch (err) {
    console.error('Photo upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/incidents/submit — create record + generate PDF
//
// CHANGES vs original:
//  • mini_co field removed (no longer accepted)
//  • delay_reason field added (required when incident_date ≠ report_date
//    AND the gap is > 1 calendar day accounting for 24-hr shift tolerance)
//  • employee info auto-populated via employee_lookup; still accepted from
//    body so the frontend can pre-fill then send it
// ─────────────────────────────────────────────────────────────────
router.post('/submit', async (req, res) => {
  try {
    const {
      employee_name, employee_number, employee_hire_date, employee_birth_date,
      employee_phone, employee_address, position_title, department, shift,
      report_date, incident_date, incident_time, location, witness, supervisor,
      report_completed_by,
      incident_types,
      injured_body_part, description_of_injury,
      description_of_incident, injury_potential, investigation_findings,
      basic_causes, corrective_actions, corrective_responsibility,
      employee_signature, investigator_signature, investigator_name,
      photos, submitted_by,
      delay_reason,       // NEW — explanation when date gap > tolerance
    } = req.body;

    if (!employee_signature || !investigator_signature) {
      return res.status(400).json({ error: 'Both employee and investigator signatures are required.' });
    }

    // ── DATE-DELAY VALIDATION ──────────────────────────────────────
    // We allow a shift-tolerance window: if incident time is 22:00 or later
    // and report_date is exactly 1 calendar day after incident_date, that's fine.
    // Otherwise if the dates differ (by more than 1 day, or by 1 day without
    // a late-shift incident time), delay_reason is required.
    const iDate = new Date(incident_date);
    const rDate = new Date(report_date);
    const dayDiff = Math.round((rDate - iDate) / (1000 * 60 * 60 * 24));

    if (dayDiff > 0) {
      // Parse incident_time to check shift-tolerance
      let isLateShift = false;
      if (incident_time) {
        const [hh] = incident_time.split(':').map(Number);
        isLateShift = hh >= 22; // 10pm or later = late shift crossing midnight
      }
      const withinShiftTolerance = dayDiff === 1 && isLateShift;

      if (!withinShiftTolerance && !delay_reason) {
        return res.status(400).json({
          error: 'Reporting delay detected. A delay explanation is required when the report date differs from the incident date.',
          delay_required: true,
          day_diff: dayDiff,
        });
      }
    }

    const INCIDENT_FOLDER_ID = 23;

    // ── INSERT RECORD ─────────────────────────────────────────────
    const insertResult = await db.query(`
      INSERT INTO incident_investigations (
        employee_name, employee_number, employee_hire_date, employee_birth_date,
        employee_phone, employee_address, position_title, department, shift,
        report_date, incident_date, incident_time, location, witness, supervisor,
        report_completed_by, incident_types,
        injured_body_part, description_of_injury,
        description_of_incident, injury_potential, investigation_findings,
        basic_causes, corrective_actions, corrective_responsibility,
        employee_signature, investigator_signature, investigator_name,
        photos, submitted_by, status, delay_reason
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
        $18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,'OPEN',$31
      ) RETURNING id
    `, [
      employee_name, employee_number, employee_hire_date, employee_birth_date,
      employee_phone, employee_address, position_title, department, shift,
      report_date, incident_date, incident_time, location, witness, supervisor,
      report_completed_by, JSON.stringify(incident_types || []),
      injured_body_part, description_of_injury,
      description_of_incident, injury_potential, investigation_findings,
      basic_causes, corrective_actions, corrective_responsibility,
      employee_signature, investigator_signature, investigator_name,
      JSON.stringify(photos || []), submitted_by,
      delay_reason || null,
    ]);

    const incidentId = insertResult.rows[0].id;

    // PDF is NOT generated here. It is generated when the investigation is CLOSED
    // after all required signatures have been collected.

    res.json({ success: true, id: incidentId, incident_id: incidentId });
  } catch (err) {
    console.error('Error submitting incident investigation:', err);
    res.status(500).json({ error: 'Failed to submit investigation' });
  }
});

// ─────────────────────────────────────────────────────────────────
// PATCH /api/incidents/:id
// ─────────────────────────────────────────────────────────────────
router.patch('/:id', async (req, res) => {
  try {
    const BLOCKED = ['id', 'created_at', 'submitted_by'];
    const safe = Object.fromEntries(Object.entries(req.body).filter(([k]) => !BLOCKED.includes(k)));
    if (!Object.keys(safe).length) return res.status(400).json({ error: 'No fields to update' });
    const keys  = Object.keys(safe);
    const vals  = Object.values(safe);
    const setCl = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
    const { rows } = await db.query(
      `UPDATE incident_investigations SET ${setCl}, updated_at = NOW() WHERE id = $${keys.length + 1} RETURNING *`,
      [...vals, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating incident:', err);
    res.status(500).json({ error: 'Failed to update' });
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/incidents/:id/request-signatures
// Stores requested additional leader IDs and sends notification emails
// Body: { additional_leader_ids: [id, ...] }
// ─────────────────────────────────────────────────────────────────
router.post('/:id/request-signatures', async (req, res) => {
  try {
    const { additional_leader_ids = [] } = req.body;

    // Get the incident record
    const { rows: incRows } = await db.query(
      `SELECT * FROM incident_investigations WHERE id = $1`, [req.params.id]
    );
    if (!incRows.length) return res.status(404).json({ error: 'Not found' });
    const incident = incRows[0];

    // Store additional leader IDs on the record
    await db.query(
      `UPDATE incident_investigations SET additional_signature_ids = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(additional_leader_ids), req.params.id]
    );

    // Find Bridgette Butler (look up by name since she's always required)
    const { rows: bridgetteRows } = await db.query(
      `SELECT employee_id, name, email FROM employees WHERE name ILIKE '%bridgette%butler%' LIMIT 1`
    );
    const bridgette = bridgetteRows[0] || null;

    // Collect emails to notify
    const recipientEmails = [];

    if (bridgette?.email) recipientEmails.push({ name: bridgette.name, email: bridgette.email });

    if (additional_leader_ids.length > 0) {
      const placeholders = additional_leader_ids.map((_, i) => `$${i + 1}`).join(',');
      const { rows: leaderRows } = await db.query(
        `SELECT employee_id, name, email FROM employees WHERE employee_id IN (${placeholders}) AND email IS NOT NULL`,
        additional_leader_ids
      );
      leaderRows.forEach(l => recipientEmails.push({ name: l.name, email: l.email }));
    }

    // Send emails
    const nodemailer = (() => { try { return require('nodemailer'); } catch { return null; } })();
    if (nodemailer && process.env.EMAIL_USER) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      });
      for (const recipient of recipientEmails) {
        if (!recipient.email) continue;
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: recipient.email,
          subject: `ACTION REQUIRED: Sign Incident Investigation — ${incident.employee_name || 'Unknown'} (${incident.incident_date || 'N/A'})`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;">
              <div style="background:#B30000;padding:20px 24px;border-radius:6px 6px 0 0;">
                <h2 style="color:#fff;margin:0;font-size:18px;letter-spacing:2px;">INCIDENT INVESTIGATION — SIGNATURE REQUIRED</h2>
                <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:12px;">Dal-Tile Muskogee Safety App</p>
              </div>
              <div style="background:#f9f9f9;padding:24px;border:1px solid #ddd;border-radius:0 0 6px 6px;">
                <p>Hi ${recipient.name},</p>
                <p>Your signature is required on an Incident Investigation Report.</p>
                <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                  <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;background:#f4f4f4;">Employee</td><td style="padding:8px;border:1px solid #ddd;">${incident.employee_name || '—'}</td></tr>
                  <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;background:#f4f4f4;">Department</td><td style="padding:8px;border:1px solid #ddd;">${incident.department || '—'}</td></tr>
                  <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;background:#f4f4f4;">Incident Date</td><td style="padding:8px;border:1px solid #ddd;">${incident.incident_date || '—'}</td></tr>
                  <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;background:#f4f4f4;">Investigator</td><td style="padding:8px;border:1px solid #ddd;">${incident.investigator_name || '—'}</td></tr>
                </table>
                <p>Please log in to the Safety App and open this investigation to add your signature.</p>
                <p style="font-size:11px;color:#888;">This is an automated notification from the Dal-Tile Muskogee Safety App.</p>
              </div>
            </div>
          `,
        }).catch(e => console.error('Email send error:', e));
      }
    }

    res.json({ success: true, notified: recipientEmails.length });
  } catch (err) {
    console.error('Error requesting signatures:', err);
    res.status(500).json({ error: 'Failed to request signatures' });
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/incidents/:id/add-signature
// Saves an additional leader signature to the investigation
// Body: { signer_id, signer_name, signature_dataurl, role }
// ─────────────────────────────────────────────────────────────────
router.post('/:id/add-signature', async (req, res) => {
  try {
    const { signer_id, signer_name, signature_dataurl, role = 'additional' } = req.body;
    if (!signature_dataurl) return res.status(400).json({ error: 'signature_dataurl required' });

    const { rows: existing } = await db.query(
      `SELECT additional_signatures FROM incident_investigations WHERE id = $1`, [req.params.id]
    );
    if (!existing.length) return res.status(404).json({ error: 'Not found' });

    let sigs = [];
    if (existing[0].additional_signatures) {
      try { sigs = JSON.parse(existing[0].additional_signatures); } catch { sigs = []; }
    }
    sigs.push({ signer_id, signer_name, role, signature_dataurl, signed_at: new Date().toISOString() });

    await db.query(
      `UPDATE incident_investigations SET additional_signatures = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(sigs), req.params.id]
    );

    res.json({ success: true, signature_count: sigs.length });
  } catch (err) {
    console.error('Error adding signature:', err);
    res.status(500).json({ error: 'Failed to add signature' });
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/incidents/:id/close
// Marks investigation CLOSED and generates the final PDF with ALL signatures
// ─────────────────────────────────────────────────────────────────
router.post('/:id/close', async (req, res) => {
  try {
    // Load full record
    const { rows } = await db.query(`SELECT * FROM incident_investigations WHERE id = $1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const r = rows[0];

    // Parse JSON fields
    const incident_types   = (() => { try { return JSON.parse(r.incident_types || '[]'); } catch { return []; } })();
    const photos           = (() => { try { return JSON.parse(r.photos         || '[]'); } catch { return []; } })();
    const additionalSigs   = (() => { try { return JSON.parse(r.additional_signatures || '[]'); } catch { return []; } })();

    const INCIDENT_FOLDER_ID = 23;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const pdfName   = `INCIDENT_${r.id}_${timestamp}.pdf`;
    const pdfDir    = '/data/documents/incidents';
    const pdfPath   = path.join(pdfDir, pdfName);
    if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });

    if (PDFDocument) {
      await new Promise((resolve, reject) => {
        const doc = new PDFDocument({
          size: 'LETTER', margins: { top: 0, right: 0, bottom: 0, left: 0 },
          autoFirstPage: true, bufferPages: true,
          info: { Title: `Incident Investigation #${r.id}`, Author: r.investigator_name || 'Dal-Tile', Creator: 'Dal-Tile Safety App' },
        });
        const stream = fs.createWriteStream(pdfPath);
        doc.pipe(stream);

        let y = drawHeader(doc, 'Incident Investigation Report');
        drawFooter(doc);

        // ID banner
        doc.rect(MARGIN, y, CONTENT, 36).fill(COLOR.issueBg);
        doc.font(FONT.bold).fontSize(13).fillColor(COLOR.issue)
           .text('INCIDENT INVESTIGATION', MARGIN + 12, y + 10);
        const idLabel = `#${r.id}`;
        const idW = doc.widthOfString(idLabel, { fontSize: 12 }) + 20;
        doc.font(FONT.bold).fontSize(12).fillColor(COLOR.issue)
           .text(idLabel, PAGE_W - MARGIN - idW, y + 12, { width: idW, align: 'center' });
        y += 48;

        // Delay banner
        if (r.delay_reason) {
          doc.rect(MARGIN, y, CONTENT, 36).fill(COLOR.warnBg);
          doc.font(FONT.bold).fontSize(8).fillColor(COLOR.warn)
             .text('REPORTING DELAY — EXPLANATION PROVIDED', MARGIN + 10, y + 6);
          doc.font(FONT.regular).fontSize(9).fillColor(COLOR.warn)
             .text(r.delay_reason, MARGIN + 10, y + 18, { width: CONTENT - 20 });
          y += 46;
        }

        // Employee / incident meta rows
        const col = CONTENT / 4;
        doc.rect(MARGIN, y, CONTENT, 72).fill(COLOR.lightGray).stroke(COLOR.border);
        metaRow(doc, 'Employee',   r.employee_name,   MARGIN + 10,           y + 10, col - 10);
        metaRow(doc, 'Employee #', r.employee_number, MARGIN + 10 + col,     y + 10, col - 10);
        metaRow(doc, 'Position',   r.position_title,  MARGIN + 10 + col * 2, y + 10, col - 10);
        metaRow(doc, 'Department', r.department,      MARGIN + 10 + col * 3, y + 10, col - 10);
        y += 84;

        doc.rect(MARGIN, y, CONTENT, 52).fill(COLOR.lightGray).stroke(COLOR.border);
        metaRow(doc, 'Incident Date', r.incident_date, MARGIN + 10,           y + 10, col - 10);
        metaRow(doc, 'Time',          r.incident_time, MARGIN + 10 + col,     y + 10, col - 10);
        metaRow(doc, 'Location',      r.location,      MARGIN + 10 + col * 2, y + 10, col - 10);
        metaRow(doc, 'Shift',         r.shift,         MARGIN + 10 + col * 3, y + 10, col - 10);
        y += 64;

        doc.rect(MARGIN, y, CONTENT, 52).fill(COLOR.lightGray).stroke(COLOR.border);
        metaRow(doc, 'Supervisor',   r.supervisor,          MARGIN + 10,           y + 10, col - 10);
        metaRow(doc, 'Witness',      r.witness,             MARGIN + 10 + col,     y + 10, col - 10);
        metaRow(doc, 'Report Date',  r.report_date,         MARGIN + 10 + col * 2, y + 10, col - 10);
        metaRow(doc, 'Completed By', r.report_completed_by, MARGIN + 10 + col * 3, y + 10, col - 10);
        y += 64;

        if (incident_types.length > 0) {
          y = sectionBar(doc, 'Type of Incident', y);
          const typeStr = incident_types.join('  ·  ');
          const typeH = Math.max(doc.heightOfString(typeStr, { width: CONTENT - 20 }) + 16, 28);
          doc.rect(MARGIN, y, CONTENT, typeH).fill(COLOR.issueBg);
          doc.font(FONT.bold).fontSize(10).fillColor(COLOR.issue)
             .text(typeStr, MARGIN + 10, y + 8, { width: CONTENT - 20 });
          y += typeH + 8;
        }

        y = sectionBar(doc, 'Injury Details', y);
        y = fieldBlock(doc, 'Injured Body Part', r.injured_body_part, y);
        y = fieldBlock(doc, 'Description of Injury', r.description_of_injury, y);
        y = sectionBar(doc, 'Description of Incident', y);
        y = fieldBlock(doc, 'What happened — who, what, where, when, how', r.description_of_incident, y);
        y = sectionBar(doc, 'Injury Potential', y);
        y = fieldBlock(doc, 'Potential injury that could have occurred', r.injury_potential, y);
        y = sectionBar(doc, 'Investigation Findings', y);
        y = fieldBlock(doc, 'Facts obtained during investigation', r.investigation_findings, y);
        y = sectionBar(doc, 'Basic Causes', y);
        y = fieldBlock(doc, 'Hazard, condition or behavior that contributed', r.basic_causes, y);
        y = sectionBar(doc, 'Corrective Actions', y);
        y = fieldBlock(doc, 'Actions to prevent recurrence', r.corrective_actions, y);
        y = fieldBlock(doc, 'Corrective Responsibility', r.corrective_responsibility, y);

        // Photos
        if (photos.length > 0) {
          y = sectionBar(doc, `Attached Photos (${photos.length})`, y);
          photos.forEach((p, pi) => {
            const fullPath = path.join('/data/uploads', path.basename(p.url));
            if (!fs.existsSync(fullPath)) return;
            const PHOTO_H = 220;
            if (y + PHOTO_H + 20 > PAGE_H - 60) {
              doc.addPage(); y = drawHeader(doc, 'Incident Investigation Report'); drawFooter(doc); y = 88;
            }
            try {
              doc.image(fullPath, (PAGE_W - 420) / 2, y, { fit: [420, PHOTO_H], align: 'center', valign: 'top' });
              doc.rect((PAGE_W - 420) / 2, y, 420, PHOTO_H).lineWidth(1).stroke(COLOR.border);
              doc.font(FONT.oblique).fontSize(8).fillColor(COLOR.midGray)
                 .text(p.name || `Photo ${pi + 1}`, MARGIN, y + PHOTO_H + 4, { align: 'center', width: CONTENT });
              y += PHOTO_H + 18;
            } catch (_) {
              doc.font(FONT.oblique).fontSize(9).fillColor(COLOR.midGray).text(`[Photo: ${p.name}]`, MARGIN, y + 4);
              y += 20;
            }
          });
        }

        // ── SIGNATURES PAGE ────────────────────────────────────────
        doc.addPage();
        y = drawHeader(doc, 'Incident Investigation Report');
        drawFooter(doc);
        y = 88;
        y = sectionBar(doc, 'Signatures & Acknowledgement', y);

        // Build full list: TM, Investigator, then all additional sigs
        const allSigs = [
          { label: 'TEAM MEMBER SIGNATURE',  name: r.employee_name    || '—', dataUrl: r.employee_signature    },
          { label: 'INVESTIGATOR SIGNATURE', name: r.investigator_name || '—', dataUrl: r.investigator_signature },
          ...additionalSigs.map(s => ({ label: (s.role || 'ADDITIONAL').toUpperCase() + ' SIGNATURE', name: s.signer_name || '—', dataUrl: s.signature_dataurl })),
        ];

        const SIG_W = (CONTENT - 20) / 2;
        const SIG_H = 100;

        for (let si = 0; si < allSigs.length; si += 2) {
          const left  = allSigs[si];
          const right = allSigs[si + 1];
          const sigY  = y + 8;
          const rowH  = SIG_H + 40;

          if (sigY + rowH > PAGE_H - 60) {
            doc.addPage(); y = drawHeader(doc, 'Incident Investigation Report'); drawFooter(doc); y = 88;
          }

          // Left sig box
          doc.rect(MARGIN, y + 8, SIG_W, rowH).stroke(COLOR.border);
          doc.font(FONT.bold).fontSize(9).fillColor(COLOR.midGray).text(left.label, MARGIN + 8, y + 14);
          doc.font(FONT.regular).fontSize(8).fillColor(COLOR.midGray).text(left.name, MARGIN + 8, y + 26);
          if (left.dataUrl && left.dataUrl.startsWith('data:image')) {
            try {
              const buf = Buffer.from(left.dataUrl.split(',')[1], 'base64');
              const tmp = `/tmp/sig_${r.id}_${si}.png`;
              fs.writeFileSync(tmp, buf);
              doc.image(tmp, MARGIN + 8, y + 38, { width: SIG_W - 16, height: SIG_H - 10, fit: [SIG_W - 16, SIG_H - 10] });
              try { fs.unlinkSync(tmp); } catch (_) {}
            } catch (_) {}
          }

          // Right sig box
          if (right) {
            const rx = MARGIN + SIG_W + 20;
            doc.rect(rx, y + 8, SIG_W, rowH).stroke(COLOR.border);
            doc.font(FONT.bold).fontSize(9).fillColor(COLOR.midGray).text(right.label, rx + 8, y + 14);
            doc.font(FONT.regular).fontSize(8).fillColor(COLOR.midGray).text(right.name, rx + 8, y + 26);
            if (right.dataUrl && right.dataUrl.startsWith('data:image')) {
              try {
                const buf = Buffer.from(right.dataUrl.split(',')[1], 'base64');
                const tmp = `/tmp/sig_${r.id}_${si + 1}.png`;
                fs.writeFileSync(tmp, buf);
                doc.image(tmp, rx + 8, y + 38, { width: SIG_W - 16, height: SIG_H - 10, fit: [SIG_W - 16, SIG_H - 10] });
                try { fs.unlinkSync(tmp); } catch (_) {}
              } catch (_) {}
            }
          }

          y += rowH + 16;
        }

        doc.flushPages();
        doc.end();
        stream.on('finish', resolve);
        stream.on('error', reject);
      });
    }

    // Store PDF in document library
    let docId = r.document_id || null;
    try {
      if (!docId) {
        const { rows: docRows } = await db.query(`
          INSERT INTO documents (folder_id, title, description, created_by)
          VALUES ($1, $2, $3, $4) RETURNING id
        `, [
          INCIDENT_FOLDER_ID,
          `Incident Investigation #${r.id} — ${r.employee_name || 'Unknown'} — ${r.incident_date || ''}`,
          `${r.department || ''} | ${r.location || ''} | Investigator: ${r.investigator_name || ''}`,
          r.submitted_by,
        ]);
        docId = docRows[0].id;
      }
      await db.query(`
        INSERT INTO document_versions (document_id, version_number, file_path, file_type, uploaded_by, change_comment)
        VALUES ($1, 1, $2, 'application/pdf', $3, 'Final PDF — Investigation Closed')
      `, [docId, `/data/documents/incidents/${pdfName}`, r.submitted_by]);
    } catch (docErr) {
      console.error('Error storing PDF in document library:', docErr);
    }

    // Mark closed + store pdf path
    const { rows: closed } = await db.query(
      `UPDATE incident_investigations SET status = 'CLOSED', pdf_path = $1, document_id = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
      [pdfPath, docId, r.id]
    );

    res.json({ success: true, incident: closed[0], pdf_path: pdfPath });
  } catch (err) {
    console.error('Error closing incident:', err);
    res.status(500).json({ error: 'Failed to close investigation' });
  }
});

module.exports = router;