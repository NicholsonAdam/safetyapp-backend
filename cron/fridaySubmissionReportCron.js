/**
 * fridaySubmissionReportCron.js
 *
 * Runs every Friday at 7:00 AM.
 *
 * Smart date logic:
 *   - Counts submissions for the CURRENT calendar month.
 *   - If today (Friday) is on or before the 7th of the month, the month
 *     just started — we skip entirely. No sense alerting leaders 3 days
 *     into January that their team hasn't submitted yet.
 *   - This naturally handles the "month ends on Wednesday, Friday is the
 *     2nd of next month" scenario.
 *
 * For each leader who has at least one active direct report with a
 * submission requirement, we send one email that lists only the employees
 * who have NOT yet met their required count.
 *
 * If ALL of a leader's employees have met their requirement, we send a
 * positive "great job" email instead.
 *
 * If a leader has NO employees with requirements this month, no email is sent.
 */

const cron         = require('node-cron');
const db           = require('../config/db');
const { sendEmail } = require('../services/emailService');

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

/**
 * Returns true if today is too early in the month to be meaningful.
 * Threshold: on or before the 7th of the month.
 */
function isTooEarlyInMonth(now) {
  return now.getDate() <= 7;
}

/**
 * Returns the number of submissions an employee has made in the given month/year.
 * Combines BBS observations, near miss reports, and inspection checklists.
 */
async function getActualSubmissions(employeeId, month, year) {
  const { rows } = await db.query(`
    SELECT COUNT(*)::int AS count
    FROM (
      SELECT observer_id AS eid, created_at FROM bbs_observations
      UNION ALL
      SELECT observer_id AS eid, created_at FROM nearmiss_reports
      UNION ALL
      SELECT inspector_id AS eid, created_at FROM inspection_checklists
    ) combined
    WHERE eid = $1
      AND EXTRACT(MONTH FROM created_at) = $2
      AND EXTRACT(YEAR  FROM created_at) = $3
  `, [employeeId, month, year]);

  return rows[0].count;
}

// ─────────────────────────────────────────────────────────────────
// CORE LOGIC
// ─────────────────────────────────────────────────────────────────
async function runFridaySubmissionReport() {
  const now   = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();

  console.log(`[FridayCron] Running submission report for ${month}/${year}...`);

  // Smart early-month guard
  if (isTooEarlyInMonth(now)) {
    console.log(`[FridayCron] Day ${now.getDate()} — too early in the month. Skipping.`);
    return;
  }

  try {
    // Get all active employees who have a submission requirement this month,
    // grouped by their leader.
    const { rows: requirements } = await db.query(`
      SELECT
        sr.employee_id,
        sr.required_count,
        e.name          AS employee_name,
        e.leader_id,
        ldr.name        AS leader_name,
        ldr.email       AS leader_email
      FROM submission_requirements sr
      JOIN employees e   ON e.employee_id   = sr.employee_id AND e.active = TRUE
      JOIN employees ldr ON ldr.employee_id = e.leader_id    AND ldr.active = TRUE
      WHERE sr.month = $1
        AND sr.year  = $2
        AND sr.required_count > 0
        AND ldr.email IS NOT NULL
      ORDER BY ldr.employee_id, e.name
    `, [month, year]);

    if (!requirements.length) {
      console.log('[FridayCron] No submission requirements found for this month. Done.');
      return;
    }

    // Group by leader
    const leaderMap = {};
    for (const row of requirements) {
      if (!leaderMap[row.leader_id]) {
        leaderMap[row.leader_id] = {
          leader_id:    row.leader_id,
          leader_name:  row.leader_name,
          leader_email: row.leader_email,
          employees:    []
        };
      }
      leaderMap[row.leader_id].employees.push(row);
    }

    const monthName = now.toLocaleString('en-US', { month: 'long' });

    // Process each leader
    for (const leader of Object.values(leaderMap)) {
      const report = [];

      for (const emp of leader.employees) {
        const actual = await getActualSubmissions(emp.employee_id, month, year);
        report.push({
          employee_id:    emp.employee_id,
          employee_name:  emp.employee_name,
          required_count: emp.required_count,
          actual_count:   actual,
          met:            actual >= emp.required_count
        });
      }

      const notMet = report.filter(r => !r.met);
      const allMet = notMet.length === 0;

      if (allMet) {
        // ── POSITIVE EMAIL ────────────────────────────────────────
        const messageBody = `
          <p>Hi ${leader.leader_name},</p>

          <p>
            Great news — all of your team members have already met their
            safety submission requirement for <strong>${monthName} ${year}</strong>.
            Thank you for leading by example and fostering a culture of safety!
          </p>

          <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:16px;">
            <thead>
              <tr style="background:#1A7A3F;color:#fff;">
                <th style="padding:8px 12px;text-align:left;">Employee ID</th>
                <th style="padding:8px 12px;text-align:left;">Name</th>
                <th style="padding:8px 12px;text-align:left;">Required</th>
                <th style="padding:8px 12px;text-align:left;">Submitted</th>
              </tr>
            </thead>
            <tbody>
              ${report.map(r => `
                <tr>
                  <td style="padding:6px 12px;border-bottom:1px solid #eee;">${r.employee_id}</td>
                  <td style="padding:6px 12px;border-bottom:1px solid #eee;">${r.employee_name}</td>
                  <td style="padding:6px 12px;border-bottom:1px solid #eee;">${r.required_count}</td>
                  <td style="padding:6px 12px;border-bottom:1px solid #eee;color:#1A7A3F;font-weight:bold;">
                    ${r.actual_count} ✓
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <p style="margin-top:20px;color:#666;font-size:13px;">
            Keep up the great work! Your dedication to safety makes a difference.
          </p>
        `;

        await sendEmail(
          leader.leader_email,
          `✅ Safety Submissions — All Complete for ${monthName} ${year}`,
          messageBody
        );

        console.log(`[FridayCron] Positive email sent to ${leader.leader_name} (${leader.leader_email})`);
      } else {
        // ── REMINDER EMAIL ────────────────────────────────────────
        const tableRows = notMet.map(r => `
          <tr>
            <td style="padding:6px 12px;border-bottom:1px solid #eee;">${r.employee_id}</td>
            <td style="padding:6px 12px;border-bottom:1px solid #eee;">${r.employee_name}</td>
            <td style="padding:6px 12px;border-bottom:1px solid #eee;">${r.required_count}</td>
            <td style="padding:6px 12px;border-bottom:1px solid #eee;color:#B30000;font-weight:bold;">
              ${r.actual_count} / ${r.required_count}
            </td>
            <td style="padding:6px 12px;border-bottom:1px solid #eee;color:#B30000;">
              ${r.required_count - r.actual_count} remaining
            </td>
          </tr>
        `).join('');

        // How many days left in the month?
        const lastDay      = new Date(year, month, 0).getDate();
        const daysLeft     = lastDay - now.getDate();
        const urgencyColor = daysLeft <= 5 ? '#B30000' : daysLeft <= 10 ? '#B56000' : '#004f9e';

        const messageBody = `
          <p>Hi ${leader.leader_name},</p>

          <p>
            This is your weekly safety submission update for
            <strong>${monthName} ${year}</strong>.
            The following team members have not yet met their required submission count.
          </p>

          <p style="color:${urgencyColor};font-weight:bold;">
            ${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining in ${monthName}.
          </p>

          <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:12px;">
            <thead>
              <tr style="background:#004f9e;color:#fff;">
                <th style="padding:8px 12px;text-align:left;">Employee ID</th>
                <th style="padding:8px 12px;text-align:left;">Name</th>
                <th style="padding:8px 12px;text-align:left;">Required</th>
                <th style="padding:8px 12px;text-align:left;">Submitted</th>
                <th style="padding:8px 12px;text-align:left;">Still Needed</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>

          ${allMet ? '' : `
            <p style="margin-top:16px;font-size:13px;color:#555;">
              Submissions can be any combination of BBS Observations, Near Miss Reports,
              or Inspection Checklists. Employees who have already met their requirement
              are not included in this list.
            </p>
          `}

          <p style="margin-top:20px;font-size:12px;color:#888;">
            This is an automated weekly report from the Safety App.
            You are receiving this because you are listed as a leader for these employees.
          </p>
        `;

        await sendEmail(
          leader.leader_email,
          `⚠️ Safety Submission Update — ${notMet.length} team member${notMet.length === 1 ? '' : 's'} pending (${monthName} ${year})`,
          messageBody
        );

        console.log(
          `[FridayCron] Reminder email sent to ${leader.leader_name} — ${notMet.length}/${leader.employees.length} employees pending`
        );
      }
    }

    console.log('[FridayCron] All leader emails sent. Done.');
  } catch (err) {
    console.error('[FridayCron] Fatal error:', err);
  }
}

// ─────────────────────────────────────────────────────────────────
// SCHEDULE — 7:00 AM every Friday (5 = Friday in cron)
// ─────────────────────────────────────────────────────────────────
cron.schedule('0 7 * * 5', runFridaySubmissionReport);
console.log('[FridayCron] Weekly submission report scheduled — runs at 7:00 AM every Friday.');

module.exports = runFridaySubmissionReport;
