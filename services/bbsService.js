console.log("USING FILE:", __filename);
const pool = require('../config/db');
const fs = require('fs');
const path = require('path');
const nodemailer = require("nodemailer");

// =========================
// FETCH ALL BBS RECORDS
// =========================
exports.fetchAllBBS = async () => {
  const result = await pool.query(`
    SELECT *
    FROM bbs_observations
    ORDER BY id DESC
  `);
  return result.rows;
};

// =========================
// INSERT NEW BBS RECORD
// =========================
exports.insertBBS = async (data, photoFile) => {
  console.log("🟦 insertBBS STARTED");
  console.log("Incoming data:", data);
  console.log("Incoming file:", photoFile);

  const {
    date,
    observer_id,
    observer_name,
    area,
    shift,
    job_area,
    job_task,
    ppe_safe,
    ppe_concern,
    ppe_comments,
    position_safe,
    position_concern,
    position_comments,
    tools_safe,
    tools_concern,
    tools_comments,
    conditions_safe,
    conditions_concern,
    conditions_comments,
    unsafe_about_activity,
    promote_safety,
    team_member_comments,
    observer_comments,
    followup_contact
  } = data;

  // =========================
  // PARSE ADDITIONAL OBSERVERS ARRAY
  // =========================
  let additionalObservers = [];
  try {
    if (data.additional_observers_array) {
      additionalObservers = JSON.parse(data.additional_observers_array);
    }
  } catch (err) {
    console.error("Error parsing additional_observers_array:", err);
  }

  // =========================
  // LOOKUP LEADER ID
  // =========================
  const leaderResult = await pool.query(
    `SELECT leader_id FROM employees WHERE employee_id = $1`,
    [observer_id]
  );
  const leader_id = leaderResult.rows[0]?.leader_id || null;

  // =========================
  // LOOKUP LEADER NAME
  // =========================
  let leader_name = null;
  if (leader_id) {
    const leaderNameResult = await pool.query(
      `SELECT name FROM employees WHERE employee_id = $1`,
      [leader_id]
    );
    leader_name = leaderNameResult.rows[0]?.name || null;
  }

  // =========================
  // LOOKUP LEADER EMAIL
  // =========================
  let leader_email = null;
  if (leader_id) {
    const leaderEmailResult = await pool.query(
      `SELECT email FROM employees WHERE employee_id = $1`,
      [leader_id]
    );
    leader_email = leaderEmailResult.rows[0]?.email || null;
  }

  // =========================
  // LOOKUP SAFETY TEAM EMAILS
  // =========================
  const safetyResult = await pool.query(
    `SELECT email FROM employees WHERE employee_id IN ('123850', '245177', '103118')`
  );
  const safetyEmails = safetyResult.rows.map(r => r.email);

  // =========================
  // SAVE PHOTO IF INCLUDED
  // =========================
  let photo_paths = [];
  if (photoFile) {
    const fileName = `bbs_${Date.now()}.jpg`;
    const uploadPath = path.join(__dirname, "..", "uploads", fileName);

    if (!fs.existsSync(path.join(__dirname, "..", "uploads"))) {
      fs.mkdirSync(path.join(__dirname, "..", "uploads"));
    }

    fs.writeFileSync(uploadPath, photoFile.buffer);
    photo_paths.push(fileName);
  }

  // =========================
  // FINAL SQL DEBUG PRINT
  // =========================
  console.log("FINAL SQL:", `
    INSERT INTO bbs_observations (
      date, observer_id, observer_name, additional_observers,
      area, shift, job_area, job_task,
      ppe_safe, ppe_concern, ppe_comments,
      proper_position_safe, proper_position_concern, proper_position_comments,
      tools_safe, tools_concern, tools_comments,
      unsafe_conditions_safe, unsafe_conditions_concern, unsafe_conditions_comments,
      unsafe_about_activity, promote_safety,
      team_member_comments, observer_comments,
      photo_paths, status,
      leader_id, leader_name,
      followup_contact
    )
    VALUES (
      $1,$2,$3,$4,
      $5,$6,$7,$8,
      $9,$10,$11,
      $12,$13,$14,
      $15,$16,$17,
      $18,$19,$20,
      $21,$22,
      $23,$24,
      $25,'Open',
      $26,$27,
      $28
    )
    RETURNING *;
  `);

  // =========================
  // SQL INSERT (CORRECT ORDER)
  // =========================
  const result = await pool.query(
    `
    INSERT INTO bbs_observations (
      date, observer_id, observer_name, additional_observers,
      area, shift, job_area, job_task,
      ppe_safe, ppe_concern, ppe_comments,
      proper_position_safe, proper_position_concern, proper_position_comments,
      tools_safe, tools_concern, tools_comments,
      unsafe_conditions_safe, unsafe_conditions_concern, unsafe_conditions_comments,
      unsafe_about_activity, promote_safety,
      team_member_comments, observer_comments,
      photo_paths, status,
      leader_id, leader_name,
      followup_contact
    )
    VALUES (
      $1,$2,$3,$4,
      $5,$6,$7,$8,
      $9,$10,$11,
      $12,$13,$14,
      $15,$16,$17,
      $18,$19,$20,
      $21,$22,
      $23,$24,
      $25,'Open',
      $26,$27,
      $28
    )
    RETURNING *;
    `,
    [
      date,
      observer_id,
      observer_name,
      additionalObservers.join(","),

      area,
      shift,
      job_area,
      job_task,

      ppe_safe === "true" || ppe_safe === true,
      ppe_concern === "true" || ppe_concern === true,
      ppe_comments,

      position_safe === "true" || position_safe === true,
      position_concern === "true" || position_concern === true,
      position_comments,

      tools_safe === "true" || tools_safe === true,
      tools_concern === "true" || tools_concern === true,
      tools_comments,

      conditions_safe === "true" || conditions_safe === true,
      conditions_concern === "true" || conditions_concern === true,
      conditions_comments,

      unsafe_about_activity,
      promote_safety,

      team_member_comments,
      observer_comments,

      photo_paths,
      leader_id,
      leader_name,

      followup_contact
    ]
  );

  console.log("🟩 SQL INSERT RESULT:", result.rows);

  // =========================
  // SEND FOLLOW-UP EMAILS IF REQUESTED
  // =========================
  if (followup_contact === "yes") {
    console.log("SMTP_USER:", process.env.SMTP_USER);
    console.log("SMTP_PASS:", process.env.SMTP_PASS ? "Loaded" : "Missing");
    const transporter = nodemailer.createTransport({
      host: "smtp.office365.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const recipients = [
      leader_email,
      ...safetyEmails
    ].filter(Boolean);

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: recipients,
      subject: `Follow-up Requested: BBS Observation #${result.rows[0].id}`,
      html: `
        <h2>BBS Observation Requires Follow-up</h2>
        <p><strong>Observer:</strong> ${observer_name} (${observer_id})</p>
        <p><strong>Area:</strong> ${area}</p>
        <p><strong>Shift:</strong> ${shift}</p>
        <p><strong>Job Task:</strong> ${job_task}</p>
        <p><strong>Unsafe Activity:</strong> ${unsafe_about_activity}</p>
        <p><strong>Observer Comments:</strong> ${observer_comments}</p>
        <p><strong>Follow-up Requested:</strong> YES</p>
        <hr/>
        <p>This message was automatically generated by the Safety App.</p>
      `
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log("📧 Follow-up email sent successfully");
    } catch (err) {
      console.error("❌ Error sending follow-up email:", err);
    }
  }

  return result.rows[0];
};