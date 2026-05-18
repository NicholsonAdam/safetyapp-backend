const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const path    = require('path');
const fs      = require('fs');
const { uploadPhotos } = require('../middleware/upload');

let PDFDocument;
try { PDFDocument = require('pdfkit'); } catch (e) { PDFDocument = null; }

// ─── Brand tokens (matches housekeeping / gemba style) ────────────
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

// ─── PDF helpers ──────────────────────────────────────────────────
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
  if (y + BAR_H + 40 > PAGE_H - 60) { doc.addPage(); y = drawHeader(doc, 'Incident Investigation Report'); drawFooter(doc); y = 88; }
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
// GET /api/incidents  — list all, optional ?status=OPEN|CLOSED
// ─────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { status, department, search, sort = 'id', direction = 'desc' } = req.query;
    let query = 'SELECT id,employee_name,employee_number,department,position_title,incident_date,report_date,status,submitted_by,created_at,investigator_name FROM incident_investigations WHERE 1=1';
    const params = [];
    if (status)     { params.push(status);           query += ` AND status = $${params.length}`; }
    if (department) { params.push(department);        query += ` AND department = $${params.length}`; }
    if (search)     { params.push(`%${search}%`);    query += ` AND (employee_name ILIKE $${params.length} OR description_of_incident ILIKE $${params.length})`; }
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
// POST /api/incidents/photos  — upload photo(s) before submit
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
// POST /api/incidents/submit  — create record + generate PDF
// Body: all form fields as JSON + signatures as base64 data URLs
// ─────────────────────────────────────────────────────────────────
router.post('/submit', async (req, res) => {
  try {
    const {
      employee_name, employee_number, employee_hire_date, employee_birth_date,
      employee_phone, employee_address, position_title, department, shift,
      report_date, incident_date, incident_time, location, witness, supervisor,
      report_completed_by, mini_co,
      incident_types,
      injured_body_part, description_of_injury,
      description_of_incident, injury_potential, investigation_findings,
      basic_causes, corrective_actions, corrective_responsibility,
      employee_signature, investigator_signature, investigator_name,
      photos, submitted_by,
    } = req.body;

    if (!employee_signature || !investigator_signature) {
      return res.status(400).json({ error: 'Both employee and investigator signatures are required.' });
    }

    const INCIDENT_FOLDER_ID = 23; // Restricted Access > Incident Investigation

    // ── INSERT RECORD ─────────────────────────────────────────────
    const insertResult = await db.query(`
      INSERT INTO incident_investigations (
        employee_name, employee_number, employee_hire_date, employee_birth_date,
        employee_phone, employee_address, position_title, department, shift,
        report_date, incident_date, incident_time, location, witness, supervisor,
        report_completed_by, mini_co, incident_types,
        injured_body_part, description_of_injury,
        description_of_incident, injury_potential, investigation_findings,
        basic_causes, corrective_actions, corrective_responsibility,
        employee_signature, investigator_signature, investigator_name,
        photos, submitted_by, status
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
        $19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,'OPEN'
      ) RETURNING id
    `, [
      employee_name, employee_number, employee_hire_date, employee_birth_date,
      employee_phone, employee_address, position_title, department, shift,
      report_date, incident_date, incident_time, location, witness, supervisor,
      report_completed_by, mini_co, JSON.stringify(incident_types || []),
      injured_body_part, description_of_injury,
      description_of_incident, injury_potential, investigation_findings,
      basic_causes, corrective_actions, corrective_responsibility,
      employee_signature, investigator_signature, investigator_name,
      JSON.stringify(photos || []), submitted_by,
    ]);

    const incidentId = insertResult.rows[0].id;

    // ── GENERATE PDF ─────────────────────────────────────────────
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const pdfName   = `INCIDENT_${incidentId}_${timestamp}.pdf`;
    const pdfDir    = '/data/documents/incidents';
    const pdfPath   = path.join(pdfDir, pdfName);
    if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });

    if (PDFDocument) {
      await new Promise((resolve, reject) => {
        const doc = new PDFDocument({
          size: 'LETTER', margins: { top: 0, right: 0, bottom: 0, left: 0 },
          autoFirstPage: true, bufferPages: true,
          info: { Title: `Incident Investigation #${incidentId}`, Author: investigator_name || 'Dal-Tile', Creator: 'Dal-Tile Safety App' },
        });

        const stream = fs.createWriteStream(pdfPath);
        doc.pipe(stream);

        let y = drawHeader(doc, 'Incident Investigation Report');
        drawFooter(doc);

        // ── Status banner ─────────────────────────────────────────
        doc.rect(MARGIN, y, CONTENT, 36).fill(COLOR.issueBg);
        doc.font(FONT.bold).fontSize(13).fillColor(COLOR.issue)
           .text('INCIDENT INVESTIGATION', MARGIN + 12, y + 10);
        const idLabel = `#${incidentId}`;
        const idW = doc.widthOfString(idLabel, { fontSize: 12 }) + 20;
        const idX = PAGE_W - MARGIN - idW;
        doc.roundedRect(idX, y + 9, idW, 18, 3).fill(COLOR.issueBg);
        doc.font(FONT.bold).fontSize(12).fillColor(COLOR.issue)
           .text(idLabel, idX, y + 12, { width: idW, align: 'center' });
        y += 48;

        // ── Employee info grid ────────────────────────────────────
        doc.rect(MARGIN, y, CONTENT, 72).fill(COLOR.lightGray).stroke(COLOR.border);
        const col = CONTENT / 4, mY = y + 10;
        metaRow(doc, 'Employee',      employee_name,       MARGIN + 10,           mY, col - 10);
        metaRow(doc, 'Employee #',    employee_number,     MARGIN + 10 + col,     mY, col - 10);
        metaRow(doc, 'Position',      position_title,      MARGIN + 10 + col * 2, mY, col - 10);
        metaRow(doc, 'Department',    department,          MARGIN + 10 + col * 3, mY, col - 10);
        y += 84;

        doc.rect(MARGIN, y, CONTENT, 52).fill(COLOR.lightGray).stroke(COLOR.border);
        const mY2 = y + 10;
        metaRow(doc, 'Incident Date', incident_date,     MARGIN + 10,           mY2, col - 10);
        metaRow(doc, 'Time',          incident_time,     MARGIN + 10 + col,     mY2, col - 10);
        metaRow(doc, 'Location',      location,          MARGIN + 10 + col * 2, mY2, col - 10);
        metaRow(doc, 'Shift',         shift,             MARGIN + 10 + col * 3, mY2, col - 10);
        y += 64;

        doc.rect(MARGIN, y, CONTENT, 52).fill(COLOR.lightGray).stroke(COLOR.border);
        const mY3 = y + 10;
        metaRow(doc, 'Supervisor',   supervisor,           MARGIN + 10,           mY3, col - 10);
        metaRow(doc, 'Witness',      witness,              MARGIN + 10 + col,     mY3, col - 10);
        metaRow(doc, 'Report Date',  report_date,          MARGIN + 10 + col * 2, mY3, col - 10);
        metaRow(doc, 'Completed By', report_completed_by, MARGIN + 10 + col * 3, mY3, col - 10);
        y += 64;

        // ── Incident types ────────────────────────────────────────
        const types = Array.isArray(incident_types) ? incident_types : [];
        if (types.length > 0) {
          y = sectionBar(doc, 'Type of Incident', y);
          const typeStr = types.join('  ·  ');
          const typeH = Math.max(doc.heightOfString(typeStr, { width: CONTENT - 20 }) + 16, 28);
          doc.rect(MARGIN, y, CONTENT, typeH).fill(COLOR.issueBg);
          doc.font(FONT.bold).fontSize(10).fillColor(COLOR.issue)
             .text(typeStr, MARGIN + 10, y + 8, { width: CONTENT - 20 });
          y += typeH + 8;
        }

        // ── Injury details ────────────────────────────────────────
        y = sectionBar(doc, 'Injury Details', y);
        y = fieldBlock(doc, 'Injured Body Part', injured_body_part, y);
        y = fieldBlock(doc, 'Description of Injury', description_of_injury, y);

        // ── Narrative sections ────────────────────────────────────
        y = sectionBar(doc, 'Description of Incident', y);
        y = fieldBlock(doc, 'What happened — who, what, where, when, how', description_of_incident, y);

        y = sectionBar(doc, 'Injury Potential', y);
        y = fieldBlock(doc, 'Potential injury that could have occurred', injury_potential, y);

        y = sectionBar(doc, 'Investigation Findings', y);
        y = fieldBlock(doc, 'Facts obtained during investigation (include witness statements)', investigation_findings, y);

        y = sectionBar(doc, 'Basic Causes', y);
        y = fieldBlock(doc, 'Hazard, condition or behavior that contributed', basic_causes, y);

        y = sectionBar(doc, 'Corrective Actions', y);
        y = fieldBlock(doc, 'Actions to prevent recurrence', corrective_actions, y);
        y = fieldBlock(doc, 'Corrective Responsibility', corrective_responsibility, y);

        // ── Attached photos ───────────────────────────────────────
        const photoList = Array.isArray(photos) ? photos : [];
        if (photoList.length > 0) {
          y = sectionBar(doc, `Attached Photos (${photoList.length})`, y);
          photoList.forEach((p, pi) => {
            const fullPath = path.join('/data/uploads', path.basename(p.url));
            if (!fs.existsSync(fullPath)) return;
            const PHOTO_H = 220;
            if (y + PHOTO_H + 20 > PAGE_H - 60) {
              doc.addPage();
              y = drawHeader(doc, 'Incident Investigation Report');
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

        // ── Signatures ────────────────────────────────────────────
        // Add new page for signatures so they're always together
        doc.addPage();
        y = drawHeader(doc, 'Incident Investigation Report');
        drawFooter(doc);
        y = 88;

        y = sectionBar(doc, 'Signatures & Acknowledgement', y);

        const SIG_W = (CONTENT - 20) / 2;
        const SIG_H = 100;
        const sigY  = y + 8;

        // Employee signature box
        doc.rect(MARGIN, sigY, SIG_W, SIG_H + 30).stroke(COLOR.border);
        doc.font(FONT.bold).fontSize(9).fillColor(COLOR.midGray)
           .text('TEAM MEMBER SIGNATURE', MARGIN + 8, sigY + 6);
        doc.font(FONT.regular).fontSize(8).fillColor(COLOR.midGray)
           .text(employee_name || '—', MARGIN + 8, sigY + 18);

        // Try to embed employee signature image
        try {
          if (employee_signature && employee_signature.startsWith('data:image')) {
            const base64Data = employee_signature.split(',')[1];
            const imgBuf = Buffer.from(base64Data, 'base64');
            const tmpSig = `/tmp/emp_sig_${incidentId}.png`;
            fs.writeFileSync(tmpSig, imgBuf);
            doc.image(tmpSig, MARGIN + 8, sigY + 28, { width: SIG_W - 16, height: SIG_H - 10, fit: [SIG_W - 16, SIG_H - 10] });
            try { fs.unlinkSync(tmpSig); } catch (_) {}
          }
        } catch (_) {
          doc.font(FONT.oblique).fontSize(9).fillColor(COLOR.midGray)
             .text('[Signature on file]', MARGIN + 8, sigY + 50);
        }

        // Investigator signature box
        const sigX2 = MARGIN + SIG_W + 20;
        doc.rect(sigX2, sigY, SIG_W, SIG_H + 30).stroke(COLOR.border);
        doc.font(FONT.bold).fontSize(9).fillColor(COLOR.midGray)
           .text('INVESTIGATOR SIGNATURE', sigX2 + 8, sigY + 6);
        doc.font(FONT.regular).fontSize(8).fillColor(COLOR.midGray)
           .text(investigator_name || '—', sigX2 + 8, sigY + 18);

        try {
          if (investigator_signature && investigator_signature.startsWith('data:image')) {
            const base64Data = investigator_signature.split(',')[1];
            const imgBuf = Buffer.from(base64Data, 'base64');
            const tmpSig = `/tmp/inv_sig_${incidentId}.png`;
            fs.writeFileSync(tmpSig, imgBuf);
            doc.image(tmpSig, sigX2 + 8, sigY + 28, { width: SIG_W - 16, height: SIG_H - 10, fit: [SIG_W - 16, SIG_H - 10] });
            try { fs.unlinkSync(tmpSig); } catch (_) {}
          }
        } catch (_) {
          doc.font(FONT.oblique).fontSize(9).fillColor(COLOR.midGray)
             .text('[Signature on file]', sigX2 + 8, sigY + 50);
        }

        doc.flushPages();
        doc.end();
        stream.on('finish', resolve);
        stream.on('error', reject);
      });
    }

    // ── STORE IN DOCUMENT LIBRARY ─────────────────────────────────
    let docId = null;
    try {
      const { rows: docRows } = await db.query(`
        INSERT INTO documents (folder_id, title, description, created_by)
        VALUES ($1, $2, $3, $4) RETURNING id
      `, [
        INCIDENT_FOLDER_ID,
        `Incident Investigation #${incidentId} — ${employee_name || 'Unknown'} — ${incident_date || report_date || ''}`,
        `${department || ''} | ${location || ''} | Investigator: ${investigator_name || ''}`,
        submitted_by,
      ]);
      docId = docRows[0].id;

      await db.query(`
        INSERT INTO document_versions (document_id, version_number, file_path, file_type, uploaded_by, change_comment)
        VALUES ($1, 1, $2, 'application/pdf', $3, 'Auto-generated from Incident Investigation')
      `, [docId, `/data/documents/incidents/${pdfName}`, submitted_by]);
    } catch (docErr) {
      console.error('Error storing incident PDF in document library:', docErr);
    }

    // Update record with pdf path and doc id
    await db.query(`
      UPDATE incident_investigations SET pdf_path = $1, document_id = $2 WHERE id = $3
    `, [pdfPath, docId, incidentId]);

    res.json({ success: true, id: incidentId, pdf_path: pdfPath, document_id: docId });
  } catch (err) {
    console.error('Error submitting incident investigation:', err);
    res.status(500).json({ error: 'Failed to submit investigation' });
  }
});

// ─────────────────────────────────────────────────────────────────
// PATCH /api/incidents/:id  — update status or fields
// ─────────────────────────────────────────────────────────────────
router.patch('/:id', async (req, res) => {
  try {
    const BLOCKED = ['id', 'created_at', 'submitted_by'];
    const safe = Object.fromEntries(Object.entries(req.body).filter(([k]) => !BLOCKED.includes(k)));
    if (!Object.keys(safe).length) return res.status(400).json({ error: 'No fields to update' });
    const keys   = Object.keys(safe);
    const vals   = Object.values(safe);
    const setCl  = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
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

module.exports = router;
