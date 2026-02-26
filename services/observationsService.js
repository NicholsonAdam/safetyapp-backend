const { getEmployeeById } = require('../models/employeeModel');
const { sendEmail } = require('../services/emailService');
const { assignObservation } = require('../models/observation_assignments');
const AREA_LEADERS = {
  "Body Prep": "103118",
  "Press": "103118",
  "Glazeline": "103118",
  "Kiln": "103118",
  "LGV": "103118",
  "Glaze Prep": "103118",
  "Sorting": "103118",
  "Rectifying": "103118",
  "Administration": "103118",
  "Maintenance": "103118"
};
const SAFETY_TEAM = ["103118"]; // add more IDs later
const pool = require('../config/db');
// Allowed statuses for each submission type
const BBS_STATUSES = [
  'awaiting_assignment',
  'in_review',
  'in_progress',
  'completed',
  'denied',
  'escalated'
];

const NEAR_MISS_STATUSES = [
  'awaiting_assignment',
  'in_progress',
  'closed'
];

// Validation helper
function isValidStatus(submissionType, status) {
  if (submissionType === 'near_miss') {
    return NEAR_MISS_STATUSES.includes(status);
  }
  return BBS_STATUSES.includes(status);
}

exports.saveObservation = async (observation) => {
  const {
    primary_observer_id,
    additional_observers,
    observed_count,
    area,
    observation_date,
    observation_time,
    ppe_ok,
    proper_position_ok,
    tools_equipment_ok,
    unsafe_conditions,
    observer_comments,
    observed_feedback,
    observed_recent_safety_actions
  } = observation;

  const query = `
    INSERT INTO observations (
  primary_observer_id,
  additional_observers,
  observed_count,
  area,
  observation_date,
  observation_time,
  ppe_ok,
  proper_position_ok,
  tools_equipment_ok,
  unsafe_conditions,
  observer_comments,
  observed_feedback,
  observed_recent_safety_actions,
  submission_type
)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
RETURNING *
  `;

  const values = [
  primary_observer_id,
  additional_observers || null,
  observed_count,
  area,
  observation_date,
  observation_time,
  ppe_ok,
  proper_position_ok,
  tools_equipment_ok,
  unsafe_conditions,
  observer_comments,
  observed_feedback,
  observed_recent_safety_actions,
  observation.submission_type || 'bbs'
];

  const result = await pool.query(query, values);
  const savedObservation = result.rows[0];
  const typeLabel = savedObservation.submission_type === 'near_miss'
  ? 'Near Miss Report'
  : 'BBS Observation';
  const headerBlock = savedObservation.submission_type === 'near_miss'
  ? `
    <div style="text-align:center; margin: 20px 0;">
      <div style="
        font-size: 20px;
        font-weight: bold;
        color: #004f9e;
        margin-bottom: 6px;
      ">
        NEAR MISS / UNSAFE CONDITIONS
      </div>

      <div style="
        font-size: 13px;
        color: #444;
        line-height: 1.4;
      ">
        An Automatic Report in the Safety Management System for Dal-Tile<br/>
        A VPP Star Facility
      </div>
    </div>
  `
  : `
    <div style="text-align:center; margin: 20px 0;">
      <div style="
        font-size: 20px;
        font-weight: bold;
        color: #004f9e;
        margin-bottom: 6px;
      ">
        BEHAVIOR BASED SAFETY
      </div>

      <div style="
        font-size: 13px;
        color: #444;
        line-height: 1.4;
      ">
        Part of the Safety Management System for Dal-Tile<br/>
        A VPP Star Facility
      </div>
    </div>
  `;

// Build the details block FIRST
const detailsBlock = savedObservation.submission_type === 'near_miss'
  ? `
    <h3 style="color:#004f9e; margin-top:20px; text-align:center;">Report Details</h3>

    <ul>
      <li><strong>Area:</strong> ${savedObservation.area}</li>
      <li><strong>Date:</strong> ${savedObservation.observation_date}</li>
      <li><strong>Time:</strong> ${savedObservation.observation_time}</li>
      <li><strong>Description:</strong> ${savedObservation.unsafe_conditions || savedObservation.observer_comments}</li>
      <li><strong>Submitted By:</strong> ${savedObservation.primary_observer_id}</li>
      <li><strong>Status:</strong> ${savedObservation.status}</li>
    </ul>
  `
  : `
    <h3 style="color:#004f9e; margin-top:20px; text-align:center;">Observation Details</h3>

    <ul>
      <li><strong>Area:</strong> ${savedObservation.area}</li>
      <li><strong>Date:</strong> ${savedObservation.observation_date}</li>
      <li><strong>Time:</strong> ${savedObservation.observation_time}</li>
      <li><strong>Observed Count:</strong> ${savedObservation.observed_count}</li>
      <li><strong>PPE OK:</strong> ${savedObservation.ppe_ok}</li>
      <li><strong>Proper Position OK:</strong> ${savedObservation.proper_position_ok}</li>
      <li><strong>Tools/Equipment OK:</strong> ${savedObservation.tools_equipment_ok}</li>
      <li><strong>Unsafe Conditions:</strong> ${savedObservation.unsafe_conditions}</li>
      <li><strong>Observer Comments:</strong> ${savedObservation.observer_comments}</li>
      <li><strong>Observed Feedback:</strong> ${savedObservation.observed_feedback}</li>
      <li><strong>Recent Safety Actions:</strong> ${savedObservation.observed_recent_safety_actions}</li>
      <li><strong>Primary Observer ID:</strong> ${savedObservation.primary_observer_id}</li>
      <li><strong>Additional Observers:</strong> ${savedObservation.additional_observers || 'None'}</li>
      <li><strong>Status:</strong> ${savedObservation.status}</li>
    </ul>
  `;

  const photosResult = await pool.query(
  'SELECT url FROM photos WHERE observation_id = $1',
  [savedObservation.id]
);

const photoUrls = photosResult.rows.map(row => row.url);
const photoBlock = photoUrls.length > 0
  ? `
    <h3 style="color:#004f9e; margin-top:20px; text-align:center;">Attached Photos</h3>
    <ul>
      ${photoUrls.map(url => `<li><a href="${url}">${url}</a></li>`).join('')}
    </ul>
  `
  : '';

const areaLeaderId = AREA_LEADERS[savedObservation.area];

const assignments = [];

if (areaLeaderId) {
  assignments.push({
    assigned_to_employee_id: areaLeaderId,
    role: 'area_leader'
  });
}

SAFETY_TEAM.forEach(id => {
  assignments.push({
    assigned_to_employee_id: id,
    role: 'safety_team'
  });
});

assignments.push({
  assigned_to_employee_id: "103118",
  role: 'admin'
});

await assignObservation(savedObservation.id, assignments);
// --- Email Notifications on Observation Creation ---
try {
const messageBody = `
  <p>A new <strong>${typeLabel}</strong> has been submitted in the Safety App.</p>

  ${headerBlock}

  ${detailsBlock}

  ${photoBlock}
`;

  // Notify Area Leader
  if (areaLeaderId) {
    const leader = await getEmployeeById(areaLeaderId);
    if (leader?.email) {
      await sendEmail(
        leader.email,
        `New ${typeLabel} Assigned`,
        messageBody
      );
    }
  }

  // Notify Safety Team
  for (const id of SAFETY_TEAM) {
    const safetyMember = await getEmployeeById(id);
    if (safetyMember?.email) {
      await sendEmail(
        safetyMember.email,
        `New ${typeLabel} Submitted`,
        messageBody
      );
    }
  }

  // Notify Admin
  const admin = await getEmployeeById("103118");
  if (admin?.email) {
    await sendEmail(
      admin.email,
      `New ${typeLabel} Logged`,
      messageBody
    );
  }
} catch (err) {
  console.error("Email notification failed:", err);
}


return savedObservation;
};

exports.updateObservationStatus = async (id, newStatus, updatedBy) => {
  // Fetch the observation
  const result = await pool.query(
    'SELECT * FROM observations WHERE id = $1',
    [id]
  );

  const observation = result.rows[0];
  if (!observation) {
    throw new Error('Observation not found');
  }

  // Validate status based on submission type
  if (!isValidStatus(observation.submission_type, newStatus)) {
    throw new Error(`Invalid status '${newStatus}' for submission type '${observation.submission_type}'`);
  }

  // Update the status
  const updateResult = await pool.query(
    `UPDATE observations
     SET status = $1, updated_by = $2, updated_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [newStatus, updatedBy, id]
  );

  return updateResult.rows[0];
};

exports.getAllObservations = async () => {
  const result = await pool.query(
    'SELECT * FROM observations ORDER BY created_at DESC'
  );
  return result.rows;
};

exports.updateObservation = async (id, observation) => {
  const {
    area,
    observation_date,
    observation_time,
    ppe_ok,
    proper_position_ok,
    tools_equipment_ok,
    unsafe_conditions,
    observer_comments,
    observed_feedback,
    observed_recent_safety_actions
  } = observation;

  const query = `
    UPDATE observations
    SET area = $1,
        observation_date = $2,
        observation_time = $3,
        ppe_ok = $4,
        proper_position_ok = $5,
        tools_equipment_ok = $6,
        unsafe_conditions = $7,
        observer_comments = $8,
        observed_feedback = $9,
        observed_recent_safety_actions = $10
    WHERE id = $11
    RETURNING *
  `;

  const values = [
    area,
    observation_date,
    observation_time,
    ppe_ok,
    proper_position_ok,
    tools_equipment_ok,
    unsafe_conditions,
    observer_comments,
    observed_feedback,
    observed_recent_safety_actions,
    id
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
};

exports.deleteObservation = async (id) => {
  const result = await pool.query(
    'DELETE FROM observations WHERE id = $1 RETURNING *',
    [id]
  );
  return result.rows[0];
};