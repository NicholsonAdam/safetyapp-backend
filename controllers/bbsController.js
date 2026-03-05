const pool = require('../config/db');
const { fetchAllBBS, insertBBS } = require('../services/bbsService');
const { sendEmail } = require('../services/emailService');   // <-- EMAIL SERVICE

// =========================
// GET ALL BBS RECORDS
// =========================
exports.getAllBBS = async (req, res) => {
  try {
    const rows = await fetchAllBBS();
    res.json(rows);
  } catch (err) {
    console.error("Error fetching BBS records:", err);
    res.status(500).json({ message: "Server error fetching BBS records" });
  }
};

// =========================
// CREATE NEW BBS RECORD
// =========================
exports.createBBS = async (req, res) => {
  try {
    const data = req.body;
    const photoFile = req.file || null;

    // Insert into DB
    const newRecord = await insertBBS(data, photoFile);

    // ======================================================
    // FOLLOW-UP EMAIL LOGIC
    // ======================================================
    if (data.followup_contact === "yes") {
      try {
        // 1. Lookup leader email
        const leaderQuery = await pool.query(
          "SELECT email FROM employees WHERE employee_id = $1",
          [data.leader_id]
        );

        const leaderEmail =
          leaderQuery.rows.length > 0 ? leaderQuery.rows[0].email : null;

        // 2. Safety team distribution list
        const safetyTeam = [
          "safety1@company.com",
          "safety2@company.com"
        ];

        // 3. Build email content
        const subject = `Follow-up Requested: BBS Observation #${newRecord.id}`;
        const messageBody = `
          <p><strong>Observer:</strong> ${data.observer_name} (${data.observer_id})</p>
          <p><strong>Area:</strong> ${data.area}</p>
          <p><strong>Shift:</strong> ${data.shift}</p>
          <p><strong>Job Task:</strong> ${data.job_task}</p>
          <p><strong>Observer Comments:</strong> ${data.observer_comments}</p>
          <p>The observer requested a follow-up regarding this BBS observation.</p>
        `;

        // 4. Send email
        await sendEmail(
          [leaderEmail, ...safetyTeam].filter(Boolean),
          subject,
          messageBody
        );

      } catch (emailErr) {
        console.error("Error sending BBS follow-up email:", emailErr);
      }
    }

    // ======================================================
    // RESPONSE
    // ======================================================
    res.json({
      message: "BBS Observation submitted successfully",
      record: newRecord
    });

  } catch (err) {
    console.error("Error creating BBS record:", err);
    res.status(500).json({ message: "Server error creating BBS record" });
  }
};

// =========================
// UPDATE STATUS
// =========================
exports.updateBBSStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const result = await pool.query(
      `UPDATE bbs_observations
       SET status = $1
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error updating BBS status:", err);
    res.status(500).json({ message: "Server error updating status" });
  }
};