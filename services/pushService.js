const webpush = require("web-push");
const db       = require("../config/db");

webpush.setVapidDetails(
  "mailto:muskogeeautomation@daltile.com",
  process.env.VAPID_PUBLIC_KEY  || "BK_hOPRyP_G-0tVO3WDE-rLXZjtOvXwTiGPNOCmrKjIDZ5ZZqIERZnGpMpyGReEIzki9AWBmWtVt0SJ6LUlF80k",
  process.env.VAPID_PRIVATE_KEY || "ePMVWYDuqQSw5dtu3710elEhcWxpsoT7NGaZc5ULgQs"
);

// Send a push notification to a specific employee (all their devices)
exports.sendPushToEmployee = async (employeeId, payload) => {
  const { rows } = await db.query(
    "SELECT * FROM push_subscriptions WHERE employee_id = $1",
    [String(employeeId)]
  );

  const results = await Promise.allSettled(
    rows.map(async (row) => {
      const subscription = {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      };
      try {
        await webpush.sendNotification(subscription, JSON.stringify(payload));
      } catch (err) {
        // 410 Gone = subscription expired, remove it
        if (err.statusCode === 410 || err.statusCode === 404) {
          await db.query("DELETE FROM push_subscriptions WHERE endpoint = $1", [row.endpoint]);
        }
        throw err;
      }
    })
  );

  const sent   = results.filter(r => r.status === "fulfilled").length;
  const failed = results.filter(r => r.status === "rejected").length;
  return { sent, failed };
};

// Send to all employees with a given role/condition
exports.sendPushToAll = async (payload) => {
  const { rows } = await db.query("SELECT DISTINCT employee_id FROM push_subscriptions");
  const results  = await Promise.allSettled(
    rows.map(r => exports.sendPushToEmployee(r.employee_id, payload))
  );
  return results;
};
