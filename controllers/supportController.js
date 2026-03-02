const nodemailer = require("nodemailer");
const pool = require("../config/db");

// Optional: only if you create a Support model
let Support = null;
try {
  Support = require("../models/Support");
} catch (e) {
  // No model yet — safe to ignore
}

exports.createSupport = async (req, res) => {
  try {
    const { submitter_id, submitter_name, date, platform, issue } = req.body;

    // Multer file
    const photo = req.file ? req.file.filename : null;

    // Base URL for images
    const BASE_URL = "https://safetyapp-backend-xq88.onrender.com";
    const photoUrl = photo ? `${BASE_URL}/uploads/${photo}` : null;

    // Optional DB record
    let record = null;
    if (Support) {
      record = await Support.create({
        date,
        platform,
        issue,
        photo_path: photo,
      });
    }

    // Email transport
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // FIXED EMAIL TEMPLATE — CLEAN, NO WHITESPACE ISSUES
    const html = `
      <h2>New Support Request</h2>

      <p><strong>Submitted By:</strong> ${submitter_name} (${submitter_id})</p>
      <p><strong>Date:</strong> ${date}</p>
      <p><strong>Platform:</strong> ${platform}</p>
      <p><strong>Issue:</strong><br>${issue}</p>

      ${photo ? `
        <p><strong>Photo:</strong></p>
        <img src="${photoUrl}"
             style="max-width: 400px; border: 1px solid #ccc; border-radius: 4px;" />
      ` : ""}
    `;

    // Send email
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: "adam.nicholson1@daltile.com",
      subject: "New Support Request Submitted",
      html,
    });

    res.json({ success: true, id: record ? record.id : null });

  } catch (err) {
    console.error("Support Create Error:", err);
    res.status(500).json({ error: "Failed to submit support request" });
  }
};