const express = require('express');
const router = express.Router();
const { sendEmail } = require('../services/emailService');

router.get('/test-email', async (req, res) => {
  try {
    await sendEmail(
      process.env.SMTP_USER, 
      'Safety App Test Email',
      'This is a test email from your Safety App backend.'
    );

    res.status(200).json({
      status: 'success',
      message: 'Test email sent successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

module.exports = router;