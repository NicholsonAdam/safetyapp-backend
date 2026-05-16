const pool = require("../config/db");
const { sendEmail } = require("../services/emailService");

const SUPPORT_RECIPIENT = process.env.SUPPORT_EMAIL || "adam.nicholson1@daltile.com";

let Support = null;
try {
  Support = require("../models/Support");
} catch (e) {}

exports.createSupport = async (req, res) => {
  try {
    const { submitter_id, submitter_name, date, platform, issue } = req.body;

    const photo = req.file ? req.file.filename : null;
    const BASE_URL = process.env.BACKEND_URL || "https://safetyapp-backend-docker.onrender.com";
    const photoUrl = photo ? `${BASE_URL}/uploads/${photo}` : null;

    let record = null;
    if (Support) {
      record = await Support.create({ date, platform, issue, photo_path: photo });
    }

    const photoBlock = photoUrl
      ? `<p><strong>Photo:</strong></p><img src="${photoUrl}" style="max-width:400px;border:1px solid #ccc;border-radius:4px;" />`
      : "";

    const messageBody =
      `<p><strong>Submitted By:</strong> ${submitter_name} (${submitter_id})</p>` +
      `<p><strong>Date:</strong> ${date}</p>` +
      `<p><strong>Platform:</strong> ${platform}</p>` +
      `<p><strong>Issue:</strong><br>${issue}</p>` +
      photoBlock;

    await sendEmail(SUPPORT_RECIPIENT, "New Support Request Submitted", messageBody);

    res.json({ success: true, id: record ? record.id : null });
  } catch (err) {
    console.error("Support Create Error:", err);
    res.status(500).json({ error: "Failed to submit support request" });
  }
};