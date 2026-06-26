const express = require("express");
const router  = express.Router();
const db      = require("../config/db");

// GET /api/push/vapid-public-key — frontend needs this to subscribe
router.get("/vapid-public-key", (req, res) => {
  res.json({
    publicKey: process.env.VAPID_PUBLIC_KEY ||
      "BK_hOPRyP_G-0tVO3WDE-rLXZjtOvXwTiGPNOCmrKjIDZ5ZZqIERZnGpMpyGReEIzki9AWBmWtVt0SJ6LUlF80k",
  });
});

// POST /api/push/subscribe
router.post("/subscribe", async (req, res) => {
  const { employee_id, subscription } = req.body;
  if (!employee_id || !subscription?.endpoint) {
    return res.status(400).json({ error: "employee_id and subscription required" });
  }

  const { endpoint, keys: { p256dh, auth } } = subscription;

  try {
    await db.query(`
      INSERT INTO push_subscriptions (employee_id, endpoint, p256dh, auth, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (endpoint) DO UPDATE SET
        employee_id = EXCLUDED.employee_id,
        p256dh      = EXCLUDED.p256dh,
        auth        = EXCLUDED.auth,
        updated_at  = NOW()
    `, [String(employee_id), endpoint, p256dh, auth]);

    res.json({ success: true });
  } catch (err) {
    console.error("[Push] Subscribe error:", err);
    res.status(500).json({ error: "Failed to save subscription" });
  }
});

// DELETE /api/push/unsubscribe
router.delete("/unsubscribe", async (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ error: "endpoint required" });

  try {
    await db.query("DELETE FROM push_subscriptions WHERE endpoint = $1", [endpoint]);
    res.json({ success: true });
  } catch (err) {
    console.error("[Push] Unsubscribe error:", err);
    res.status(500).json({ error: "Failed to remove subscription" });
  }
});

module.exports = router;
