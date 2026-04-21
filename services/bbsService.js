console.log("USING FILE:", __filename);
const pool = require('../config/db');

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
exports.insertBBS = async (data, photo_paths = []) => {
  console.log("🟦 insertBBS STARTED");
  console.log("Incoming data:", data);
  console.log("Incoming photo paths:", photo_paths);

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

  // Parse additional observers
  let additionalObservers = [];
  try {
    if (data.additional_observers_array) {
      additionalObservers = JSON.parse(data.additional_observers_array);
    }
  } catch (err) {
    console.error("Error parsing additional_observers_array:", err);
  }

  // Leader lookup
  const leaderResult = await pool.query(
    `SELECT leader_id FROM employees WHERE employee_id = $1`,
    [observer_id]
  );
  const leader_id = leaderResult.rows[0]?.leader_id || null;

  let leader_name = null;
  if (leader_id) {
    const leaderNameResult = await pool.query(
      `SELECT name FROM employees WHERE employee_id = $1`,
      [leader_id]
    );
    leader_name = leaderNameResult.rows[0]?.name || null;
  }

  // =========================
  // SQL INSERT
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

  return result.rows[0];
};
