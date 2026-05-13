const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const PDFDocument = require("pdfkit");

const { uploadPhotos } = require("../../middleware/upload");

const PDF_DIR = "/data/documents/ladder-inspection";
if (!fs.existsSync(PDF_DIR)) {
  fs.mkdirSync(PDF_DIR, { recursive: true });
}

// ─── Brand tokens ────────────────────────────────────────────────────────────
const COLOR = {
  red:        "#B30000",
  redDark:    "#7A0000",
  redLight:   "#FFE8E8",
  charcoal:   "#1A1A1A",
  midGray:    "#4A4A4A",
  lightGray:  "#F4F4F4",
  border:     "#DDDDDD",
  white:      "#FFFFFF",
  good:       "#1A7A3F",
  goodBg:     "#E8F5EE",
  issue:      "#B30000",
  issueBg:    "#FFE8E8",
  na:         "#5A5A5A",
  naBg:       "#F0F0F0",
};

const FONT = {
  regular: "Helvetica",
  bold:    "Helvetica-Bold",
  oblique: "Helvetica-Oblique",
};

// ─── Data maps ────────────────────────────────────────────────────────────────
const QUESTION_MAP = {
  railsDamage:        "Cracked, bent, or split rails?",
  rungsDamage:        "Missing, loose, or damaged rungs/steps?",
  hardwareDamage:     "Loose or missing bolts, rivets, or fasteners?",
  corrosion:          "Corrosion, rust, or deterioration?",
  feetCondition:      "Ladder feet intact and not worn?",
  modified:           "Has the ladder been modified, repaired, or altered in any way?",
  generalWear:        "Any other visible structural damage?",

  stableSurface:      "Placed on stable, level surface?",
  noWobble:           "No wobble, rocking, or instability?",
  feetSlipResistant:  "Slip-resistant feet present and functional?",
  properAngle:        "Proper angle (for extension ladders)?",

  cleanRungs:         "Rungs clean and free of oil/grease?",
  spreadersFunctional:"Spreaders/locks functional (step ladders)?",
  ropePulley:         "Rope and pulley system intact (extension)?",
  labelsReadable:     "Safety labels present and readable?",
  sharpEdges:         "No sharp edges or burrs?",

  properPlacement:    "Proper placement (not blocking walkways)?",
  electricalHazards:  "No electrical hazards nearby?",
  trafficProtection:  "Protected from vehicle/pedestrian traffic?",

  noOverloading:      "No signs of overloading or bending?",
  noDeflection:       "No rung or rail deflection under weight?",
};

const VALUE_META = {
  yes: { label: "Good",           color: COLOR.good,  bg: COLOR.goodBg  },
  no:  { label: "Issue",          color: COLOR.issue, bg: COLOR.issueBg },
  na:  { label: "Not Applicable", color: COLOR.na,    bg: COLOR.naBg    },
};

// ─── Layout helpers ───────────────────────────────────────────────────────────
const PAGE_W  = 612;   // US Letter
const PAGE_H  = 792;
const MARGIN  = 40;
const CONTENT = PAGE_W - MARGIN * 2;

/**
 * Draws the full-bleed header bar and returns the Y position where
 * body content can start.
 */
function drawHeader(doc, ladderId) {
  // Red strip
  doc.rect(0, 0, PAGE_W, 72).fill(COLOR.red);

  // Logo
  const LOGO_PATH = path.join(__dirname, "..", "..", "public", "logo.jpg");
  let logoRight = MARGIN;
  try {
    doc.image(LOGO_PATH, MARGIN, 14, { height: 44 });
    logoRight = MARGIN + 60;
  } catch (_) {}

  // Company + report title
  doc
    .fillColor(COLOR.white)
    .font(FONT.bold)
    .fontSize(15)
    .text("  DAL-TILE  ·  MUSKOGEE", logoRight + 12, 16, { lineBreak: false });

  doc
    .font(FONT.regular)
    .fontSize(10)
    .fillColor("rgba(255,255,255,0.80)")
    .text("  Ladder Safety Inspection Report", logoRight + 12, 36, { lineBreak: false });

  // Location pill (right side)
  if (ladderId) {
    const pillLabel = `LOCATION  ${ladderId}`;
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
  }

  doc.fillColor(COLOR.charcoal);
  return 84; // first usable Y
}

/**
 * Persistent footer on every page.
 */
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
      "Dal-Tile Safety App  ·  Muskogee Operations  ·  CONFIDENTIAL",
      MARGIN, y, { lineBreak: false }
    );

  doc
    .text(`Page ${doc.bufferedPageRange().start + doc.bufferedPageRange().count}`, 0, y, {
      align: "right",
      width: PAGE_W - MARGIN,
      lineBreak: false,
    });

  doc.fillColor(COLOR.charcoal);
}

/**
 * Draws a labelled metadata row inside a summary box.
 * Returns new Y.
 */
function metaRow(doc, label, value, x, y, colW) {
  doc.font(FONT.bold).fontSize(8).fillColor(COLOR.midGray)
     .text(label.toUpperCase(), x, y, { width: colW, lineBreak: false });
  doc.font(FONT.regular).fontSize(10).fillColor(COLOR.charcoal)
     .text(value || "—", x, y + 10, { width: colW, lineBreak: false });
  return y + 28;
}

/**
 * Draws a two-column checklist row with a coloured status badge.
 * Returns new Y (with overflow: adds a new page automatically).
 */
function checklistRow(doc, question, rawValue, y, ladderId) {
  const ROW_H     = 22;
  const BADGE_W   = 110;
  const Q_W       = CONTENT - BADGE_W - 12;
  const BOTTOM_LIMIT = PAGE_H - 60;

  if (y + ROW_H > BOTTOM_LIMIT) {
    doc.addPage();
    drawHeader(doc, ladderId);
    drawFooter(doc);
    y = 88;
  }

  const meta = VALUE_META[rawValue] || VALUE_META.na;
  const isEven = Math.floor((y - 88) / ROW_H) % 2 === 0;

  // Row background (zebra stripe)
  if (isEven) {
    doc.rect(MARGIN, y, CONTENT, ROW_H).fill(COLOR.lightGray);
  }

  // Question text
  doc
    .font(FONT.regular)
    .fontSize(9.5)
    .fillColor(COLOR.charcoal)
    .text(question, MARGIN + 8, y + 5, {
      width: Q_W,
      lineBreak: false,
    });

  // Status badge
  const badgeX = MARGIN + Q_W + 12;
  doc
    .roundedRect(badgeX, y + 3, BADGE_W, 16, 3)
    .fill(meta.bg);
  doc
    .font(FONT.bold)
    .fontSize(8)
    .fillColor(meta.color)
    .text(meta.label, badgeX, y + 6, {
      width: BADGE_W,
      align: "center",
      lineBreak: false,
    });

  return y + ROW_H;
}

/**
 * Draws a full-width section divider bar.
 * Returns new Y.
 */
function sectionBar(doc, title, y, ladderId) {
  const BAR_H = 24;

  // Check if there's room
  if (y + BAR_H + 40 > PAGE_H - 60) {
    doc.addPage();
    drawHeader(doc, ladderId);
    drawFooter(doc);
    y = 88;
  }

  doc.rect(MARGIN, y, CONTENT, BAR_H).fill(COLOR.red);
  doc
    .font(FONT.bold)
    .fontSize(10)
    .fillColor(COLOR.white)
    .text(title.toUpperCase(), MARGIN + 10, y + 7, {
      width: CONTENT - 20,
      lineBreak: false,
    });
  doc.fillColor(COLOR.charcoal);
  return y + BAR_H + 8;
}

// ─── Checklist groupings ──────────────────────────────────────────────────────
const SECTIONS = [
  {
    title: "Ladder Condition (Structural Integrity)",
    keys: [
      "railsDamage","rungsDamage","hardwareDamage",
      "corrosion","feetCondition","modified","generalWear"
    ],
  },
  {
    title: "Stability & Support",
    keys: [
      "stableSurface","noWobble","feetSlipResistant","properAngle"
    ],
  },
  {
    title: "Safety Features",
    keys: [
      "cleanRungs","spreadersFunctional","ropePulley",
      "labelsReadable","sharpEdges"
    ],
  },
  {
    title: "Usage & Environment",
    keys: [
      "properPlacement","electricalHazards","trafficProtection"
    ],
  },
  {
    title: "Load Rating & Capacity",
    keys: [
      "noOverloading","noDeflection"
    ],
  },
];

// ─── Route ────────────────────────────────────────────────────────────────────
router.post("/", uploadPhotos.single("photo"), async (req, res) => {
  try {
    const { ladderId, notes, submitter, ...fields } = req.body;
    const employeeId = req.headers["employee_id"];
    const submittedBy = submitter || "Unknown";

    if (!employeeId) {
      return res.status(400).json({ success: false, error: "Missing employee_id header." });
    }

    const photoPath = req.file ? req.file.path : null;
    const pdfPath   = path.join(PDF_DIR, `LadderInspection_${ladderId}_${Date.now()}.pdf`);

    // Tally issues for the summary strip
    const allValues  = Object.values(fields);
    const issueCount = allValues.filter(v => v === "no").length;
    const goodCount  = allValues.filter(v => v === "yes").length;
    const naCount    = allValues.filter(v => v === "na").length;
    const overallStatus = issueCount > 0 ? "ISSUES FOUND" : "PASSED";

    // Build PDF
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
      autoFirstPage: true,
      bufferPages: true,
      info: {
        Title:   `Ladder Inspection – ${ladderId}`,
        Author:  submittedBy,
        Subject: "Dal-Tile Safety Inspection",
        Creator: "Dal-Tile Safety App",
      },
    });

    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    // PAGE 1
    let y = drawHeader(doc, ladderId);
    drawFooter(doc);

    // Status banner
    const bannerColor = issueCount > 0 ? COLOR.issue : COLOR.good;
    const bannerBg    = issueCount > 0 ? COLOR.issueBg : COLOR.goodBg;
    doc.rect(MARGIN, y, CONTENT, 36).fill(bannerBg);
    doc
      .font(FONT.bold).fontSize(13).fillColor(bannerColor)
      .text(overallStatus, MARGIN + 12, y + 10, { lineBreak: false });

    // Mini tally pills on the right
    const pills = [
      { label: `${goodCount} Good`,  bg: COLOR.goodBg,  fg: COLOR.good  },
      { label: `${issueCount} Issue${issueCount !== 1 ? "s" : ""}`, bg: COLOR.issueBg, fg: COLOR.issue },
      { label: `${naCount} N/A`,     bg: COLOR.naBg,    fg: COLOR.na    },
    ];
    let pillX = PAGE_W - MARGIN;
    pills.reverse().forEach(p => {
      const w = doc.widthOfString(p.label, { fontSize: 8 }) + 16;
      pillX -= w + 6;
      doc.roundedRect(pillX, y + 9, w, 16, 3).fill(p.bg);
      doc.font(FONT.bold).fontSize(8).fillColor(p.fg)
         .text(p.label, pillX, y + 13, { width: w, align: "center", lineBreak: false });
    });

    doc.fillColor(COLOR.charcoal);
    y += 48;

    // Metadata grid (2 columns)
    doc.rect(MARGIN, y, CONTENT, 72).fill(COLOR.lightGray);
    doc.rect(MARGIN, y, CONTENT, 72).stroke(COLOR.border);

    const col = CONTENT / 4;
    const metaY = y + 10;
    metaRow(doc, "Location / Ladder ID", ladderId,      MARGIN + 10,           metaY, col - 10);
    metaRow(doc, "Inspected By",         submittedBy,   MARGIN + 10 + col,     metaY, col - 10);
    metaRow(doc, "Employee ID",          employeeId,    MARGIN + 10 + col * 2, metaY, col - 10);
    metaRow(
      doc,
      "Date & Time",
      new Date().toLocaleString("en-US", {
        timeZone: "America/Chicago",
        dateStyle: "medium",
        timeStyle: "short",
      }),
      MARGIN + 10 + col * 3,
      metaY,
      col - 10
    );

    y += 84;

    // Checklist sections
    SECTIONS.forEach(section => {
      y = sectionBar(doc, section.title, y, ladderId);
      section.keys.forEach(key => {
        const rawValue = fields[key];
        if (rawValue === undefined) return;
        const question = QUESTION_MAP[key] || key;
        y = checklistRow(doc, question, rawValue, y, ladderId);
      });
      y += 6;
    });

    // Notes
    if (notes && notes.trim()) {
      y = sectionBar(doc, "Inspector Notes", y, ladderId);
      const noteText = notes.trim();
      const noteH    = doc.heightOfString(noteText, {
        width: CONTENT - 20,
        font:  FONT.regular,
        fontSize: 10,
      }) + 20;

      if (y + noteH > PAGE_H - 60) {
        doc.addPage();
        drawHeader(doc, ladderId);
        drawFooter(doc);
        y = 88;
      }

      doc.rect(MARGIN, y, CONTENT, noteH).fill(COLOR.lightGray).stroke(COLOR.border);
      doc.font(FONT.regular).fontSize(10).fillColor(COLOR.charcoal)
         .text(noteText, MARGIN + 10, y + 10, { width: CONTENT - 20 });

      y += noteH + 12;
    }

    // Photo
    if (photoPath) {
      const PHOTO_H = 280;
      if (y + PHOTO_H + 50 > PAGE_H - 60) {
        doc.addPage();
        drawHeader(doc, ladderId);
        drawFooter(doc);
        y = 88;
      }

      y = sectionBar(doc, "Attached Photo", y, ladderId);

      try {
        const maxW = 420;
        const maxH = 260;
        doc.image(photoPath, (PAGE_W - maxW) / 2, y, {
          fit:    [maxW, maxH],
          align:  "center",
          valign: "top",
        });
        doc.rect((PAGE_W - maxW) / 2, y, maxW, maxH)
           .lineWidth(1)
           .stroke(COLOR.border);
      } catch (_) {
        doc.font(FONT.oblique).fontSize(10).fillColor(COLOR.midGray)
           .text("Photo attachment could not be rendered.", MARGIN, y + 10);
      }
    }

    // Finalize
    doc.flushPages();
    doc.end();

    stream.on("finish", async () => {
      const pool = require("../../config/db");

      const docResult = await pool.query(
        `INSERT INTO documents (folder_id, title, description, created_by, created_at, is_active)
         VALUES ($1, $2, $3, $4, NOW(), true)
         RETURNING id`,
        [20, `Ladder Inspection - ${ladderId}`, notes || "", employeeId]
      );

      const documentId = docResult.rows[0].id;

      await pool.query(
        `INSERT INTO document_versions (document_id, version_number, file_path, file_type, uploaded_by, uploaded_at, change_comment)
         VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
        [documentId, 1, pdfPath, "application/pdf", employeeId, "Initial upload"]
      );

      return res.json({
        success: true,
        message: "Ladder inspection submitted.",
        pdfPath,
        photoPath,
      });
    });

    stream.on("error", (err) => {
      console.error("PDF stream error:", err);
      res.status(500).json({ success: false, error: "PDF write error." });
    });

  } catch (err) {
    console.error("Ladder Inspection Error:", err);
    res.status(500).json({ success: false, error: "Server error." });
  }
});

module.exports = router;
