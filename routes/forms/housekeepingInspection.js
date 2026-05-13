const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const PDFDocument = require("pdfkit");

const { uploadPhotos } = require("../../middleware/upload");

const PDF_DIR = "/data/documents/housekeeping-inspection";
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

// ─── Data maps (from your HousekeepingInspection.jsx) ─────────────────────────
const QUESTION_MAP = {
  floorsClean:               "Floors clean and free of debris?",
  tripHazards:               "No trip hazards (cords, hoses, clutter)?",
  walkwaysClear:             "Walkways clear and unobstructed?",
  noSpills:                  "No leaks, spills, or wet floors?",
  adequateLighting:          "Adequate lighting in work areas?",

  flammablesCabinet:         "Flammables stored in approved cabinets?",
  noOpenFlammables:          "No open containers of flammables?",
  groundingBonding:          "Proper grounding/bonding where required?",
  ignitionSources:           "Combustibles kept away from ignition sources?",

  properLabels:              "All chemical containers labeled (HMIS/GHS)?",
  secondaryContainers:       "No secondary containers without labels?",
  sdsAvailable:              "SDS available and accessible?",
  labelsReadable:            "No damaged or unreadable labels?",

  trashDisposed:             "Trash and scrap disposed properly?",
  noOverflowingBins:         "No overflowing waste containers?",
  recyclablesSorted:         "Recyclables sorted and stored correctly?",
  noCombustibleAccumulation: "No accumulation of combustible waste?",

  extinguishersClear:        "Fire extinguishers accessible and unobstructed?",
  exitsClear:                "Emergency exits clear and marked?",
  electricalPanelsClear:     "No blocked electrical panels?",
  spillKitsStocked:          "Spill kits stocked and accessible?",
};

const VALUE_META = {
  yes: { label: "Good",           color: COLOR.good,  bg: COLOR.goodBg  },
  no:  { label: "Issue",          color: COLOR.issue, bg: COLOR.issueBg },
  na:  { label: "Not Applicable", color: COLOR.na,    bg: COLOR.naBg    },
};

// ─── Layout constants ─────────────────────────────────────────────────────────
const PAGE_W  = 612;
const PAGE_H  = 792;
const MARGIN  = 40;
const CONTENT = PAGE_W - MARGIN * 2;

// ─── Header ───────────────────────────────────────────────────────────────────
function drawHeader(doc, area) {
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
    .text("  Housekeeping Safety Inspection Report", logoRight + 12, 36, { lineBreak: false });

  if (area) {
    const pillLabel = `AREA  ${area}`;
    const pillW = doc.widthOfString(pillLabel, { fontSize: 10 }) + 24;
    const pillX = PAGE_W - MARGIN - pillW;

    doc.roundedRect(pillX, 22, pillW, 26, 4).fill("rgba(0,0,0,0.25)");

    doc
      .font(FONT.bold)
      .fontSize(10)
      .fillColor(COLOR.charcoal)   // ← YOUR CHANGE
      .text(pillLabel, pillX, 31, { width: pillW, align: "center", lineBreak: false });
  }

  doc.fillColor(COLOR.charcoal);
  return 84;
}

// ─── Footer ───────────────────────────────────────────────────────────────────
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
    .text("Dal-Tile Safety App  ·  Muskogee Operations  ·  CONFIDENTIAL", MARGIN, y);

  doc.text(
    `Page ${doc.bufferedPageRange().start + doc.bufferedPageRange().count}`,
    0,
    y,
    { align: "right", width: PAGE_W - MARGIN }
  );

  doc.fillColor(COLOR.charcoal);
}

// ─── Metadata row ─────────────────────────────────────────────────────────────
function metaRow(doc, label, value, x, y, colW) {
  doc.font(FONT.bold).fontSize(8).fillColor(COLOR.midGray)
     .text(label.toUpperCase(), x, y, { width: colW });

  doc.font(FONT.regular).fontSize(10).fillColor(COLOR.charcoal)
     .text(value || "—", x, y + 10, { width: colW });

  return y + 28;
}

// ─── Checklist row ───────────────────────────────────────────────────────────
function checklistRow(doc, question, rawValue, y, area) {
  const ROW_H = 22;
  const BADGE_W = 110;
  const Q_W = CONTENT - BADGE_W - 12;

  if (y + ROW_H > PAGE_H - 60) {
    doc.addPage();
    drawHeader(doc, area);
    drawFooter(doc);
    y = 88;
  }

  const meta = VALUE_META[rawValue] || VALUE_META.na;
  const isEven = Math.floor((y - 88) / ROW_H) % 2 === 0;

  if (isEven) {
    doc.rect(MARGIN, y, CONTENT, ROW_H).fill(COLOR.lightGray);
  }

  doc.font(FONT.regular).fontSize(9.5).fillColor(COLOR.charcoal)
     .text(question, MARGIN + 8, y + 5, { width: Q_W });

  const badgeX = MARGIN + Q_W + 12;

  doc.roundedRect(badgeX, y + 3, BADGE_W, 16, 3).fill(meta.bg);

  doc.font(FONT.bold).fontSize(8).fillColor(meta.color)
     .text(meta.label, badgeX, y + 6, { width: BADGE_W, align: "center" });

  return y + ROW_H;
}

// ─── Section bar ─────────────────────────────────────────────────────────────
function sectionBar(doc, title, y, area) {
  const BAR_H = 24;

  if (y + BAR_H + 40 > PAGE_H - 60) {
    doc.addPage();
    drawHeader(doc, area);
    drawFooter(doc);
    y = 88;
  }

  doc.rect(MARGIN, y, CONTENT, BAR_H).fill(COLOR.red);

  doc.font(FONT.bold).fontSize(10).fillColor(COLOR.white)
     .text(title.toUpperCase(), MARGIN + 10, y + 7);

  doc.fillColor(COLOR.charcoal);
  return y + BAR_H + 8;
}

// ─── Housekeeping Sections (from your JSX) ───────────────────────────────────
const SECTIONS = [
  {
    title: "General Housekeeping & Walkways",
    keys: ["floorsClean","tripHazards","walkwaysClear","noSpills","adequateLighting"],
  },
  {
    title: "Flammables & Combustibles Storage",
    keys: ["flammablesCabinet","noOpenFlammables","groundingBonding","ignitionSources"],
  },
  {
    title: "Chemical Labeling & Hazard Communication (HMIS/GHS)",
    keys: ["properLabels","secondaryContainers","sdsAvailable","labelsReadable"],
  },
  {
    title: "Waste, Scrap, and Material Handling",
    keys: ["trashDisposed","noOverflowingBins","recyclablesSorted","noCombustibleAccumulation"],
  },
  {
    title: "Fire Safety & Emergency Access",
    keys: ["extinguishersClear","exitsClear","electricalPanelsClear","spillKitsStocked"],
  },
];

// ─── Route ───────────────────────────────────────────────────────────────────
router.post("/", uploadPhotos.single("photo"), async (req, res) => {
  try {
    const { area, notes, submitter, ...fields } = req.body;
    const employeeId = req.headers["employee_id"];
    const submittedBy = submitter || "Unknown";

    if (!employeeId) {
      return res.status(400).json({ success: false, error: "Missing employee_id header." });
    }

    const photoPath = req.file ? req.file.path : null;
    const pdfPath = path.join(PDF_DIR, `HousekeepingInspection_${area}_${Date.now()}.pdf`);

    const allValues = Object.values(fields);
    const issueCount = allValues.filter(v => v === "no").length;
    const goodCount  = allValues.filter(v => v === "yes").length;
    const naCount    = allValues.filter(v => v === "na").length;

    const overallStatus = issueCount > 0 ? "ISSUES FOUND" : "PASSED";

    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
      autoFirstPage: true,
      bufferPages: true,
      info: {
        Title:   `Housekeeping Inspection – ${area}`,
        Author:  submittedBy,
        Subject: "Dal-Tile Safety Inspection",
        Creator: "Dal-Tile Safety App",
      },
    });

    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    // PAGE 1
    let y = drawHeader(doc, area);
    drawFooter(doc);

    // Status banner
    const bannerColor = issueCount > 0 ? COLOR.issue : COLOR.good;
    const bannerBg    = issueCount > 0 ? COLOR.issueBg : COLOR.goodBg;

    doc.rect(MARGIN, y, CONTENT, 36).fill(bannerBg);
    doc.font(FONT.bold).fontSize(13).fillColor(bannerColor)
       .text(overallStatus, MARGIN + 12, y + 10);

    const pills = [
      { label: `${goodCount} Good`,  bg: COLOR.goodBg,  fg: COLOR.good },
      { label: `${issueCount} Issue${issueCount !== 1 ? "s" : ""}`, bg: COLOR.issueBg, fg: COLOR.issue },
      { label: `${naCount} N/A`,     bg: COLOR.naBg,    fg: COLOR.na },
    ];

    let pillX = PAGE_W - MARGIN;
    pills.reverse().forEach(p => {
      const w = doc.widthOfString(p.label, { fontSize: 8 }) + 16;
      pillX -= w + 6;

      doc.roundedRect(pillX, y + 9, w, 16, 3).fill(p.bg);
      doc.font(FONT.bold).fontSize(8).fillColor(p.fg)
         .text(p.label, pillX, y + 13, { width: w, align: "center" });
    });

    y += 48;

    // Metadata grid
    doc.rect(MARGIN, y, CONTENT, 72).fill(COLOR.lightGray).stroke(COLOR.border);

    const col = CONTENT / 4;
    const metaY = y + 10;

    metaRow(doc, "Area / Location", area,          MARGIN + 10,           metaY, col - 10);
    metaRow(doc, "Inspected By",    submittedBy,   MARGIN + 10 + col,     metaY, col - 10);
    metaRow(doc, "Employee ID",     employeeId,    MARGIN + 10 + col * 2, metaY, col - 10);
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
      y = sectionBar(doc, section.title, y, area);

      section.keys.forEach(key => {
        const rawValue = fields[key];
        if (rawValue === undefined) return;

        const question = QUESTION_MAP[key] || key;
        y = checklistRow(doc, question, rawValue, y, area);
      });

      y += 6;
    });

    // Notes
    if (notes && notes.trim()) {
      y = sectionBar(doc, "Inspector Notes", y, area);

      const noteText = notes.trim();
      const noteH = doc.heightOfString(noteText, {
        width: CONTENT - 20,
        font: FONT.regular,
        fontSize: 10,
      }) + 20;

      if (y + noteH > PAGE_H - 60) {
        doc.addPage();
        drawHeader(doc, area);
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
        drawHeader(doc, area);
        drawFooter(doc);
        y = 88;
      }

      y = sectionBar(doc, "Attached Photo", y, area);

      try {
        const maxW = 420;
        const maxH = 260;

        doc.image(photoPath, (PAGE_W - maxW) / 2, y, {
          fit: [maxW, maxH],
          align: "center",
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

    doc.flushPages();
    doc.end();

    stream.on("finish", async () => {
      const pool = require("../../config/db");

      const docResult = await pool.query(
        `INSERT INTO documents (folder_id, title, description, created_by, created_at, is_active)
         VALUES ($1, $2, $3, $4, NOW(), true)
         RETURNING id`,
        [21, `Housekeeping Inspection - ${area}`, notes || "", employeeId]
      );

      const documentId = docResult.rows[0].id;

      await pool.query(
        `INSERT INTO document_versions (document_id, version_number, file_path, file_type, uploaded_by, uploaded_at, change_comment)
         VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
        [documentId, 1, pdfPath, "application/pdf", employeeId, "Initial upload"]
      );

      return res.json({
        success: true,
        message: "Housekeeping inspection submitted.",
        pdfPath,
        photoPath,
      });
    });

    stream.on("error", (err) => {
      console.error("PDF stream error:", err);
      res.status(500).json({ success: false, error: "PDF write error." });
    });

  } catch (err) {
    console.error("Housekeeping Inspection Error:", err);
    res.status(500).json({ success: false, error: "Server error." });
  }
});

module.exports = router;
