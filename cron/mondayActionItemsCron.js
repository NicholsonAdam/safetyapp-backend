const cron   = require("node-cron");
const db     = require("../config/db");
const { sendEmail } = require("../services/emailService");

// ── Runs every Monday at 7:00 AM Central ─────────────────────────────────────
// For each leader who owns open action items:
//   - Section A: newly assigned to them (no prior notification)
//   - Section B: already informed (notified before)
// Excludes COMPLETE and DUPLICATE_SUBMISSION statuses.
// Sends one email per owner, only their own items.
// ─────────────────────────────────────────────────────────────────────────────

const FILES_BASE = process.env.BACKEND_URL || "https://safetyapp-backend-docker.onrender.com";

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function statusLabel(s) {
  const map = {
    OPEN: "Open", IN_PROGRESS: "In Progress", DELAYED: "Delayed",
    ON_HOLD: "On Hold", CANCELED: "Canceled",
  };
  return map[s] || s;
}

function statusColor(s) {
  const map = { OPEN: "#ef4444", IN_PROGRESS: "#3b82f6", DELAYED: "#f59e0b", ON_HOLD: "#a78bfa" };
  return map[s] || "#94a3b8";
}

function buildItemHtml(item, backendUrl) {
  const photos = Array.isArray(item.attachments)
    ? item.attachments.filter(a => a.type === "photo")
    : [];

  const photoHtml = photos.length > 0
    ? photos.slice(0, 3).map(p =>
        `<img src="${backendUrl}${p.url}" alt="photo" style="max-width:200px;max-height:140px;border-radius:6px;border:1px solid #e2e8f0;margin-right:8px;vertical-align:top;" />`
      ).join("")
    : "";

  return `
    <div style="border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:12px;background:#fff;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
        <span style="font-weight:700;color:#1e293b;font-size:14px;">#${item.id} — ${item.department || "—"}</span>
        <span style="background:${statusColor(item.status)};color:#fff;border-radius:4px;padding:2px 10px;font-size:11px;font-weight:700;">${statusLabel(item.status)}</span>
      </div>
      <div style="font-size:13px;color:#334155;line-height:1.6;margin-bottom:8px;">${item.description || "—"}</div>
      ${item.element ? `<div style="font-size:11px;color:#64748b;margin-bottom:6px;">Element: <strong>${item.element}</strong></div>` : ""}
      ${item.classification ? `<div style="font-size:11px;color:#64748b;margin-bottom:6px;">Classification: <strong>${item.classification}</strong></div>` : ""}
      <div style="font-size:11px;color:#94a3b8;">
        Submitted: ${formatDate(item.date_submitted)} &nbsp;·&nbsp; Last updated: ${formatDate(item.date_last_update)}
      </div>
      ${photoHtml ? `<div style="margin-top:10px;">${photoHtml}</div>` : ""}
    </div>
  `;
}

function buildEmailBody(ownerName, newItems, existingItems, backendUrl) {
  const hasNew      = newItems.length > 0;
  const hasExisting = existingItems.length > 0;

  return `
    <div style="font-family:Arial,sans-serif;max-width:680px;color:#1e293b;">
      <div style="background:linear-gradient(135deg,#1e3a8a,#2563eb);padding:28px 32px;border-radius:10px 10px 0 0;">
        <div style="font-size:11px;letter-spacing:3px;color:rgba(255,255,255,0.7);text-transform:uppercase;margin-bottom:6px;">Weekly Action Item Summary</div>
        <div style="font-size:22px;font-weight:800;color:#fff;">Hello, ${ownerName}</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.75);margin-top:4px;">Here is your Action Item summary for this week.</div>
      </div>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;padding:28px 32px;border-radius:0 0 10px 10px;">

        ${hasNew ? `
        <div style="margin-bottom:28px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
            <div style="width:4px;height:24px;background:#3b82f6;border-radius:2px;"></div>
            <div>
              <div style="font-size:13px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#1e293b;">Newly Assigned to You</div>
              <div style="font-size:11px;color:#64748b;margin-top:2px;">${newItems.length} item${newItems.length !== 1 ? "s" : ""} recently assigned — please review and begin work.</div>
            </div>
          </div>
          ${newItems.map(i => buildItemHtml(i, backendUrl)).join("")}
        </div>
        ` : ""}

        ${hasExisting ? `
        <div style="margin-bottom:12px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
            <div style="width:4px;height:24px;background:#94a3b8;border-radius:2px;"></div>
            <div>
              <div style="font-size:13px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#1e293b;">Already Assigned to You</div>
              <div style="font-size:11px;color:#64748b;margin-top:2px;">${existingItems.length} item${existingItems.length !== 1 ? "s" : ""} previously assigned — if there are any updates, please log them in the app.</div>
            </div>
          </div>
          ${existingItems.map(i => buildItemHtml(i, backendUrl)).join("")}
        </div>
        ` : ""}

        ${!hasNew && !hasExisting ? `<p style="color:#64748b;text-align:center;padding:20px 0;">No open action items assigned to you this week.</p>` : ""}

        <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center;">
          This is an automated weekly summary from the Dal-Tile Muskogee Safety App.
        </div>
      </div>
    </div>
  `;
}

async function sendMondayActionItemEmails() {
  console.log("[MondayCron] Running Monday action item email job...");

  try {
    // Fetch all open action items (exclude Complete + Duplicate)
    const { rows: items } = await db.query(`
      SELECT ai.*, e.name AS owner_name, e.email AS owner_email
      FROM action_items ai
      JOIN employees e ON e.employee_id::text = ai.current_owner_user_id::text
      WHERE ai.status NOT IN ('COMPLETE', 'DUPLICATE_SUBMISSION')
        AND ai.current_owner_user_id IS NOT NULL
        AND e.email IS NOT NULL
        AND e.active = true
      ORDER BY ai.current_owner_user_id, ai.id
    `);

    if (items.length === 0) {
      console.log("[MondayCron] No open action items found.");
      return;
    }

    // Fetch existing notification records
    const { rows: notifRows } = await db.query(`
      SELECT action_item_id, owner_user_id FROM action_item_notifications
    `);
    const notifiedSet = new Set(notifRows.map(r => `${r.action_item_id}:${r.owner_user_id}`));

    // Group items by owner
    const byOwner = {};
    for (const item of items) {
      const key = item.current_owner_user_id;
      if (!byOwner[key]) byOwner[key] = { name: item.owner_name, email: item.owner_email, items: [] };
      byOwner[key].items.push(item);
    }

    let emailsSent = 0;

    for (const [ownerId, { name, email, items: ownerItems }] of Object.entries(byOwner)) {
      const newItems      = ownerItems.filter(i => !notifiedSet.has(`${i.id}:${ownerId}`));
      const existingItems = ownerItems.filter(i =>  notifiedSet.has(`${i.id}:${ownerId}`));

      const subject  = `[Safety App] Your Action Items — ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;
      const body     = buildEmailBody(name, newItems, existingItems, FILES_BASE);

      try {
        await sendEmail(email, subject, body);
        emailsSent++;

        // Upsert notification records for all current items
        for (const item of ownerItems) {
          await db.query(`
            INSERT INTO action_item_notifications (action_item_id, owner_user_id, first_notified, last_notified)
            VALUES ($1, $2, NOW(), NOW())
            ON CONFLICT (action_item_id, owner_user_id)
            DO UPDATE SET last_notified = NOW()
          `, [item.id, ownerId]);
        }

        // Clean up notifications for items no longer owned by this person
        // (handles reassignment — next owner will see them as "new")
        await db.query(`
          DELETE FROM action_item_notifications
          WHERE owner_user_id = $1
            AND action_item_id NOT IN (
              SELECT id FROM action_items
              WHERE current_owner_user_id::text = $1::text
                AND status NOT IN ('COMPLETE', 'DUPLICATE_SUBMISSION')
            )
        `, [ownerId]);

        console.log(`[MondayCron] Sent to ${name} (${email}): ${newItems.length} new, ${existingItems.length} existing`);
      } catch (emailErr) {
        console.error(`[MondayCron] Failed to send to ${email}:`, emailErr.message);
      }
    }

    console.log(`[MondayCron] Done. Emails sent: ${emailsSent}`);
  } catch (err) {
    console.error("[MondayCron] Fatal error:", err);
  }
}

// Schedule: Monday 7:00 AM Central Time
cron.schedule("0 7 * * 1", sendMondayActionItemEmails, {
  timezone: "America/Chicago",
});

console.log("[MondayCron] Monday action item emails scheduled — 7:00 AM every Monday.");

module.exports = { sendMondayActionItemEmails };
