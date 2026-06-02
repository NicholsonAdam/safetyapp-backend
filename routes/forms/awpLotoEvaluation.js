const express = require("express");
const router  = express.Router();
const path    = require("path");
const fs      = require("fs");
const PDFDocument = require("pdfkit");

const pool = require("../../config/db");

const AWP_LOTO_FOLDER_ID = parseInt(process.env.AWP_LOTO_EVALUATION_FOLDER_ID) || 25;

const PDF_DIR = "/data/documents/awp-loto-evaluation";
if (!fs.existsSync(PDF_DIR)) {
  fs.mkdirSync(PDF_DIR, { recursive: true });
}

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const COLOR = {
  red:       "#B30000",
  redDark:   "#7A0000",
  redLight:  "#FFE8E8",
  charcoal:  "#1A1A1A",
  midGray:   "#4A4A4A",
  lightGray: "#F4F4F4",
  border:    "#DDDDDD",
  white:     "#FFFFFF",
  good:      "#1A7A3F",
  goodBg:    "#E8F5EE",
  issue:     "#B30000",
  issueBg:   "#FFE8E8",
  yellow:    "#7A6000",
  yellowBg:  "#FFFAE8",
};

const FONT = {
  regular: "Helvetica",
  bold:    "Helvetica-Bold",
  oblique: "Helvetica-Oblique",
};

const PAGE_W  = 612;
const PAGE_H  = 792;
const MARGIN  = 40;
const CONTENT = PAGE_W - MARGIN * 2;

// ─── Evaluation questions (from the form) ────────────────────────────────────
const QUESTIONS = [
  "Authorized Employee(s) understand procedure",
  "Affected Employee(s) notified",
  "Follow AWP/LOTO and perform task described",
  "Verify equipment is ready to be returned to service",
  "Verify no personnel are exposed",
  "Restart equipment",
  "Verify equipment/process is operating properly",
  "AWP/LOTO is now complete",
];

// ─── Layout helpers ───────────────────────────────────────────────────────────
function drawHeader(doc, evalType) {
  doc.rect(0, 0, PAGE_W, 72).fill(COLOR.red);

  const LOGO_PATH = path.join(__dirname, "..", "..", "public", "logo.jpg");
  let logoRight = MARGIN;
  try {
    doc.image(LOGO_PATH, MARGIN, 14, { height: 44 });
    logoRight = MARGIN + 60;
  } catch (_) {}

  doc
    .fillColor(COLOR.white)
    .font(FONT.bold)
    .fontSize(15)
    .text("  DAL-TILE  ·  MUSKOGEE", logoRight + 12, 16, { lineBreak: false });

  doc
    .font(FONT.regular)
    .fontSize(10)
    .fillColor("rgba(255,255,255,0.80)")
    .text("  Control of Hazardous Energy — Annual Skills Evaluation", logoRight + 12, 36, { lineBreak: false });

  // Type pill (AWP / LOTO / AWP & LOTO)
  const pillLabel = evalType || "AWP/LOTO";
  const pillW = doc.widthOfString(pillLabel, { fontSize: 10 }) + 24;
  const pillX = PAGE_W - MARGIN - pillW;
  doc
    .roundedRect(pillX, 22, pillW, 26, 4)
    .fill("rgba(0,0,0,0.25)");
  doc
    .font(FONT.bold)
    .fontSize(10)
    .fillColor(COLOR.charcoal)
    .text(pillLabel, pillX, 31, { width: pillW, align: "center", lineBreak: false });

  doc.fillColor(COLOR.charcoal);
  return 84;
}

function drawFooter(doc) {
  const y = PAGE_H - 28;
  doc
    .moveTo(MARGIN, y - 4)
    .lineTo(PAGE_W - MARGIN, y - 4)
    .lineWidth(0.5)
    .stroke(COLOR.border);

  doc
    .font(FONT.regular)
    .fontSize(8)
    .fillColor(COLOR.midGray)
    .text(
      "Dal-Tile Safety App  ·  Muskogee Operations  ·  MAR-SAF-326-PROG – Lockout / Tagout  ·  Appendix J",
      MARGIN, y, { lineBreak: false }
    );

  doc
    .text(
      `Page ${doc.bufferedPageRange().start + doc.bufferedPageRange().count}`,
      0, y,
      { align: "right", width: PAGE_W - MARGIN, lineBreak: false }
    );

  doc.fillColor(COLOR.charcoal);
}

function sectionBar(doc, title, y) {
  if (y + 64 > PAGE_H - 60) {
    doc.addPage();
    drawHeader(doc, "");
    drawFooter(doc);
    y = 88;
  }
  doc.rect(MARGIN, y, CONTENT, 24).fill(COLOR.red);
  doc
    .font(FONT.bold)
    .fontSize(10)
    .fillColor(COLOR.white)
    .text(title.toUpperCase(), MARGIN + 10, y + 7, {
      width: CONTENT - 20,
      lineBreak: false,
    });
  doc.fillColor(COLOR.charcoal);
  return y + 24 + 8;
}

function metaCell(doc, label, value, x, y, w) {
  doc.font(FONT.bold).fontSize(8).fillColor(COLOR.midGray)
     .text(label.toUpperCase(), x, y, { width: w, lineBreak: false });
  doc.font(FONT.regular).fontSize(10).fillColor(COLOR.charcoal)
     .text(value || "—", x, y + 10, { width: w, lineBreak: false });
}

// ─── Route ────────────────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const {
      evalType,
      date,
      trainerName,
      trainerSignature,   // base64 data-URL
      employeeName,
      employeeSignature,  // base64 data-URL
      machine,
      ...answerFields     // q0 … q7  →  "yes" | "no"
    } = req.body;

    const employeeId = req.headers["employee_id"];
    if (!employeeId) {
      return res.status(400).json({ success: false, error: "Missing employee_id header." });
    }

    const pdfPath = path.join(PDF_DIR, `AWP_LOTO_Eval_${Date.now()}.pdf`);
    const answers = QUESTIONS.map((_, i) => answerFields[`q${i}`] || "no");

    // ── Build PDF ─────────────────────────────────────────────────────────
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
      autoFirstPage: true,
      bufferPages: true,
      info: {
        Title:   "AWP/LOTO Annual Skills Evaluation",
        Author:  trainerName || "Dal-Tile",
        Subject: "Control of Hazardous Energy",
        Creator: "Dal-Tile Safety App",
      },
    });

    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    // PAGE 1 ──────────────────────────────────────────────────────────────
    let y = drawHeader(doc, evalType);
    drawFooter(doc);

    // ── Type banner ───────────────────────────────────────────────────────
    const allYes = answers.every(a => a === "yes");
    const bannerBg    = allYes ? COLOR.goodBg  : COLOR.yellowBg;
    const bannerColor = allYes ? COLOR.good    : COLOR.yellow;
    const bannerLabel = allYes ? "ALL ITEMS CERTIFIED" : "EVALUATION ON FILE";
    doc.rect(MARGIN, y, CONTENT, 36).fill(bannerBg);
    doc.font(FONT.bold).fontSize(13).fillColor(bannerColor)
       .text(bannerLabel, MARGIN + 12, y + 10, { lineBreak: false });
    doc.fillColor(COLOR.charcoal);
    y += 48;

    // ── Metadata grid ─────────────────────────────────────────────────────
    const META_H = 80;
    doc.rect(MARGIN, y, CONTENT, META_H).fill(COLOR.lightGray).stroke(COLOR.border);

    const col = CONTENT / 4;
    const mY  = y + 10;

    const formattedDate = date
      ? new Date(date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
      : "—";

    metaCell(doc, "Evaluation Type",  evalType || "—",        MARGIN + 10,           mY, col - 15);
    metaCell(doc, "Date",             formattedDate,           MARGIN + 10 + col,     mY, col - 15);
    metaCell(doc, "Trainer",          trainerName || "—",      MARGIN + 10 + col*2,   mY, col - 15);
    metaCell(doc, "Employee",         employeeName || "—",     MARGIN + 10 + col*3,   mY, col - 15);

    // Machine field (second row)
    doc.font(FONT.bold).fontSize(8).fillColor(COLOR.midGray)
       .text("MACHINE / EQUIPMENT", MARGIN + 10, mY + 34, { width: CONTENT - 20, lineBreak: false });
    doc.font(FONT.regular).fontSize(10).fillColor(COLOR.charcoal)
       .text(machine || "—", MARGIN + 10, mY + 44, { width: CONTENT - 20, lineBreak: false });

    y += META_H + 12;

    // ── Signatures side-by-side ───────────────────────────────────────────
    y = sectionBar(doc, "Authorized Signatures", y);

    const sigBoxW = (CONTENT - 12) / 2;
    const sigBoxH = 90;

    // Trainer box
    doc.rect(MARGIN, y, sigBoxW, sigBoxH).fill(COLOR.lightGray).stroke(COLOR.border);
    doc.font(FONT.bold).fontSize(8).fillColor(COLOR.midGray)
       .text("AUTHORIZED TRAINER", MARGIN + 10, y + 8, { lineBreak: false });
    doc.font(FONT.regular).fontSize(9).fillColor(COLOR.charcoal)
       .text(trainerName || "—", MARGIN + 10, y + 20, { lineBreak: false });

    if (trainerSignature && trainerSignature.startsWith("data:image")) {
      try {
        const b64 = trainerSignature.replace(/^data:image\/\w+;base64,/, "");
        const buf = Buffer.from(b64, "base64");
        doc.image(buf, MARGIN + 10, y + 32, { width: sigBoxW - 20, height: 48, fit: [sigBoxW - 20, 48] });
      } catch (_) {
        doc.font(FONT.oblique).fontSize(8).fillColor(COLOR.midGray)
           .text("(Signature on file)", MARGIN + 10, y + 44, { lineBreak: false });
      }
    } else {
      doc.font(FONT.oblique).fontSize(8).fillColor(COLOR.midGray)
         .text("(No signature captured)", MARGIN + 10, y + 44, { lineBreak: false });
    }

    // Employee box
    const empBoxX = MARGIN + sigBoxW + 12;
    doc.rect(empBoxX, y, sigBoxW, sigBoxH).fill(COLOR.lightGray).stroke(COLOR.border);
    doc.font(FONT.bold).fontSize(8).fillColor(COLOR.midGray)
       .text("AUTHORIZED EMPLOYEE", empBoxX + 10, y + 8, { lineBreak: false });
    doc.font(FONT.regular).fontSize(9).fillColor(COLOR.charcoal)
       .text(employeeName || "—", empBoxX + 10, y + 20, { lineBreak: false });

    if (employeeSignature && employeeSignature.startsWith("data:image")) {
      try {
        const b64 = employeeSignature.replace(/^data:image\/\w+;base64,/, "");
        const buf = Buffer.from(b64, "base64");
        doc.image(buf, empBoxX + 10, y + 32, { width: sigBoxW - 20, height: 48, fit: [sigBoxW - 20, 48] });
      } catch (_) {
        doc.font(FONT.oblique).fontSize(8).fillColor(COLOR.midGray)
           .text("(Signature on file)", empBoxX + 10, y + 44, { lineBreak: false });
      }
    } else {
      doc.font(FONT.oblique).fontSize(8).fillColor(COLOR.midGray)
         .text("(No signature captured)", empBoxX + 10, y + 44, { lineBreak: false });
    }

    y += sigBoxH + 16;

    // ── Checklist ─────────────────────────────────────────────────────────
    y = sectionBar(doc, "Skills Evaluation Checklist", y);

    const ROW_H  = 28;
    const BADGE_W = 70;
    const Q_W    = CONTENT - BADGE_W - 16;

    QUESTIONS.forEach((question, i) => {
      if (y + ROW_H > PAGE_H - 60) {
        doc.addPage();
        drawHeader(doc, evalType);
        drawFooter(doc);
        y = 88;
      }

      const value  = answers[i];
      const isYes  = value === "yes";
      const isEven = i % 2 === 0;

      if (isEven) doc.rect(MARGIN, y, CONTENT, ROW_H).fill(COLOR.lightGray);

      // Item number
      doc.font(FONT.bold).fontSize(8).fillColor(COLOR.midGray)
         .text(`${i + 1}.`, MARGIN + 6, y + 8, { width: 16, lineBreak: false });

      // Question text
      doc.font(FONT.regular).fontSize(9.5).fillColor(COLOR.charcoal)
         .text(question, MARGIN + 24, y + 8, { width: Q_W - 18, lineBreak: false });

      // Yes / No badge
      const badgeX  = MARGIN + Q_W + 12;
      const badgeBg = isYes ? COLOR.goodBg  : COLOR.issueBg;
      const badgeFg = isYes ? COLOR.good    : COLOR.issue;
      const badgeTx = isYes ? "YES"         : "NO";

      doc.roundedRect(badgeX, y + 5, BADGE_W, 18, 3).fill(badgeBg);
      doc.font(FONT.bold).fontSize(9).fillColor(badgeFg)
         .text(badgeTx, badgeX, y + 9, { width: BADGE_W, align: "center", lineBreak: false });

      y += ROW_H;
    });

    y += 10;

    // ── Certification statement ────────────────────────────────────────────
    if (y + 40 > PAGE_H - 60) {
      doc.addPage();
      drawHeader(doc, evalType);
      drawFooter(doc);
      y = 88;
    }

    doc.rect(MARGIN, y, CONTENT, 38).fill(COLOR.lightGray).stroke(COLOR.border);
    doc.font(FONT.oblique).fontSize(9).fillColor(COLOR.midGray)
       .text(
         "The Authorized person(s) above certify that the employee listed has been evaluated and demonstrated " +
         "the skills and knowledge required to perform AWP/LOTO procedures in accordance with MAR-SAF-326-PROG.",
         MARGIN + 10, y + 10,
         { width: CONTENT - 20 }
       );

    // ── Finalize ──────────────────────────────────────────────────────────
    doc.flushPages();
    doc.end();

    stream.on("finish", async () => {
      const title = `AWP/LOTO Evaluation – ${employeeName || "Unknown"} – ${formattedDate}`;

      const docResult = await pool.query(
        `INSERT INTO documents (folder_id, title, description, created_by, created_at, is_active)
         VALUES ($1, $2, $3, $4, NOW(), true)
         RETURNING id`,
        [AWP_LOTO_FOLDER_ID, title, `Eval type: ${evalType || "N/A"} | Machine: ${machine || "N/A"}`, employeeId]
      );

      const documentId = docResult.rows[0].id;

      await pool.query(
        `INSERT INTO document_versions (document_id, version_number, file_path, file_type, uploaded_by, uploaded_at, change_comment)
         VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
        [documentId, 1, pdfPath, "application/pdf", employeeId, "Initial upload"]
      );

      return res.json({ success: true, message: "AWP/LOTO evaluation submitted.", pdfPath });
    });

    stream.on("error", (err) => {
      console.error("PDF stream error:", err);
      res.status(500).json({ success: false, error: "PDF write error." });
    });

  } catch (err) {
    console.error("AWP/LOTO Evaluation Error:", err);
    res.status(500).json({ success: false, error: "Server error." });
  }
});

module.exports = router;