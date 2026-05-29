/**
 * trainingExpiryCron.js
 *
 * Runs daily at 6:00 AM.
 * For every active training type, checks all employees whose latest
 * record falls within any configured warning window and sends email
 * notifications to the training type's notify list.
 *
 * Each warning window fires exactly once: a 30-day warning fires only
 * when the expiry is between 30 and 29 days away (i.e. today is the
 * first day inside that window), preventing repeat spam.
 */

const cron         = require('node-cron');
const db           = require('../config/db');
const { sendEmail } = require('../services/emailService');

// ─────────────────────────────────────────────────────────────────
// CORE LOGIC — exported so it can be called manually / tested
// ─────────────────────────────────────────────────────────────────
async function runTrainingExpiryCheck() {
  console.log('[TrainingCron] Starting expiry check...');

  try {
    // Load all active training types that have notification recipients
    const { rows: types } = await db.query(`
      SELECT * FROM training_types
      WHERE active = TRUE
        AND array_length(notify_employee_ids, 1) > 0
    `);

    if (!types.length) {
      console.log('[TrainingCron] No active training types with notify lists. Done.');
      return;
    }

    for (const type of types) {
      const warningDays = type.warning_days || [30];

      for (const warnDay of warningDays) {
        // Find employees whose expiry date is EXACTLY `warnDay` days from today
        // (i.e. today is the first day of this warning window).
        // We also catch anyone who expired TODAY (warnDay = 0 edge).
        const { rows: expiring } = await db.query(`
          SELECT DISTINCT ON (tr.employee_id)
            tr.employee_id,
            tr.training_date,
            tr.expiry_date,
            e.name          AS employee_name,
            e.department,
            e.shift,
            ldr.name        AS leader_name,
            ldr.employee_id AS leader_id
          FROM training_records tr
          JOIN employees     e   ON e.employee_id   = tr.employee_id
          LEFT JOIN employees ldr ON ldr.employee_id = e.leader_id
          WHERE tr.training_type_id = $1
            AND e.active = TRUE
            AND tr.expiry_date = CURRENT_DATE + ($2 * INTERVAL '1 day')
          ORDER BY tr.employee_id, tr.training_date DESC
        `, [type.id, warnDay]);

        if (!expiring.length) continue;

        // Build email content
        const windowLabel = warnDay === 0
          ? 'TODAY (expired)'
          : warnDay === 1
            ? 'in 1 day'
            : `in ${warnDay} days`;

        const tableRows = expiring.map(emp => `
          <tr>
            <td style="padding:6px 12px;border-bottom:1px solid #eee;">${emp.employee_id}</td>
            <td style="padding:6px 12px;border-bottom:1px solid #eee;">${emp.employee_name}</td>
            <td style="padding:6px 12px;border-bottom:1px solid #eee;">${emp.department || '—'}</td>
            <td style="padding:6px 12px;border-bottom:1px solid #eee;">${emp.leader_name || '—'}</td>
            <td style="padding:6px 12px;border-bottom:1px solid #eee;">${emp.training_date}</td>
            <td style="padding:6px 12px;border-bottom:1px solid #eee;color:#B30000;font-weight:bold;">
              ${emp.expiry_date}
            </td>
          </tr>
        `).join('');

        const messageBody = `
          <p>
            The following employees have <strong>${type.name}</strong> training
            expiring <strong>${windowLabel}</strong>. Please schedule re-training.
          </p>

          <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:16px;">
            <thead>
              <tr style="background:#004f9e;color:#fff;">
                <th style="padding:8px 12px;text-align:left;">Employee ID</th>
                <th style="padding:8px 12px;text-align:left;">Name</th>
                <th style="padding:8px 12px;text-align:left;">Department</th>
                <th style="padding:8px 12px;text-align:left;">Leader</th>
                <th style="padding:8px 12px;text-align:left;">Last Trained</th>
                <th style="padding:8px 12px;text-align:left;">Expiry Date</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>

          <p style="margin-top:20px;font-size:13px;color:#666;">
            Training type: <strong>${type.name}</strong> |
            Frequency: every <strong>${type.frequency_days} days</strong>
          </p>
        `;

        // Resolve email addresses for all notify_employee_ids
        const { rows: notifyEmps } = await db.query(`
          SELECT email FROM employees
          WHERE employee_id = ANY($1)
            AND email IS NOT NULL
            AND active = TRUE
        `, [type.notify_employee_ids]);

        for (const { email } of notifyEmps) {
          try {
            await sendEmail(
              email,
              `Training Expiry Alert — ${type.name} expiring ${windowLabel} (${expiring.length} employee${expiring.length === 1 ? '' : 's'})`,
              messageBody
            );
          } catch (emailErr) {
            console.error(`[TrainingCron] Email failed to ${email}:`, emailErr.message);
          }
        }

        console.log(
          `[TrainingCron] ${type.name} | ${warnDay}d warning | ${expiring.length} employees | notified ${notifyEmps.length} recipients`
        );
      }
    }

    console.log('[TrainingCron] Expiry check complete.');
  } catch (err) {
    console.error('[TrainingCron] Fatal error:', err);
  }
}

// ─────────────────────────────────────────────────────────────────
// SCHEDULE — 6:00 AM every day
// ─────────────────────────────────────────────────────────────────
cron.schedule('0 6 * * *', runTrainingExpiryCheck);
console.log('[TrainingCron] Expiry check scheduled — runs at 6:00 AM daily.');

module.exports = runTrainingExpiryCheck;
