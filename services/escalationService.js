const { getEmployeeById } = require('../models/employeeModel');
const { sendEmail } = require('../services/emailService');
const pool = require('../config/db');
const { assignObservation } = require('../models/observation_assignments');
const { logStatusChange } = require('../models/observationStatusHistory');

exports.escalateObservation = async (observationId, fromEmployeeId, toEmployeeId, reason) => {
  // Insert escalation record
  await pool.query(
    `INSERT INTO observation_escalations (
      observation_id,
      escalated_from,
      escalated_to,
      reason
    ) VALUES ($1, $2, $3, $4)`,
    [observationId, fromEmployeeId, toEmployeeId, reason]
  );

  // Create new assignment for the escalated-to leader
  await assignObservation(observationId, [
    {
      assigned_to_employee_id: toEmployeeId,
      role: 'escalated_leader'
    }
  ]);

  // Log status change
  await logStatusChange(
    observationId,
    'in_progress',      // or whatever the old status is
    'escalated',
    fromEmployeeId
  );

  // Update the observation status
  await pool.query(
    `UPDATE observations SET status = 'escalated' WHERE id = $1`,
    [observationId]
  );
  // --- Email Notification on Escalation ---
try {
  const observationResult = await pool.query(
    `SELECT * FROM observations WHERE id = $1`,
    [observationId]
  );
  const observation = observationResult.rows[0];

  const messageBody = `
    <p>An observation has been escalated and assigned to you.</p>

    <h3 style="color:#004f9e; margin-top:20px;">Escalation Reason</h3>
    <p>${reason}</p>

    <h3 style="color:#004f9e; margin-top:20px;">Observation Details</h3>
    <ul>
      <li><strong>Area:</strong> ${observation.area}</li>
      <li><strong>Date:</strong> ${observation.observation_date}</li>
      <li><strong>Time:</strong> ${observation.observation_time}</li>
      <li><strong>Observed Count:</strong> ${observation.observed_count}</li>
      <li><strong>PPE OK:</strong> ${observation.ppe_ok}</li>
      <li><strong>Proper Position OK:</strong> ${observation.proper_position_ok}</li>
      <li><strong>Tools/Equipment OK:</strong> ${observation.tools_equipment_ok}</li>
      <li><strong>Unsafe Conditions:</strong> ${observation.unsafe_conditions}</li>
      <li><strong>Observer Comments:</strong> ${observation.observer_comments}</li>
      <li><strong>Observed Feedback:</strong> ${observation.observed_feedback}</li>
      <li><strong>Recent Safety Actions:</strong> ${observation.observed_recent_safety_actions}</li>
      <li><strong>Primary Observer ID:</strong> ${observation.primary_observer_id}</li>
      <li><strong>Additional Observers:</strong> ${observation.additional_observers || 'None'}</li>
      <li><strong>Status:</strong> escalated</li>
    </ul>
  `;

  const newLeader = await getEmployeeById(toEmployeeId);
  if (newLeader?.email) {
    await sendEmail(
      newLeader.email,
      'Observation Escalated to You',
      messageBody
    );
  }
} catch (err) {
  console.error("Escalation email failed:", err);
}
  // --- Email Notification on Escalation ---
try {
  const newLeader = await getEmployeeById(toEmployeeId);
  if (newLeader?.email) {
    await sendEmail(
      newLeader.email,
      'Observation Escalated to You',
      `An observation has been escalated and assigned to you. Reason: ${reason}`
    );
  }
} catch (err) {
  console.error("Escalation email failed:", err);
}

  return { success: true };
};