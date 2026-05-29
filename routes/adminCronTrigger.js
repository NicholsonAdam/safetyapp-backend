/**
 * cronTrigger.js
 * 
 * Admin-only route to manually trigger cron jobs for testing.
 * Protect this in production — only accessible to site admins.
 * 
 * POST /api/admin/cron/training-expiry
 * POST /api/admin/cron/friday-report
 */

const express = require('express');
const router  = express.Router();

router.post('/cron/training-expiry', async (req, res) => {
  try {
    const run = require('../cron/trainingExpiryCron');
    await run();
    res.json({ success: true, message: 'Training expiry check completed.' });
  } catch (err) {
    console.error('Manual training expiry trigger failed:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/cron/friday-report', async (req, res) => {
  try {
    const run = require('../cron/fridaySubmissionReportCron');
    await run();
    res.json({ success: true, message: 'Friday submission report completed.' });
  } catch (err) {
    console.error('Manual friday report trigger failed:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
