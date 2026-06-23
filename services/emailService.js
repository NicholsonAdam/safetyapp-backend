const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtpmail.mohawkind.com",
  port: parseInt(process.env.SMTP_PORT) || 25,
  secure: process.env.SMTP_SECURE === "true",
  // opportunistic TLS — upgrade if the server offers it, but don't hard-fail if it doesn't
  opportunisticTLS: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

function buildEmailTemplate(title, messageBody) {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
      <div style="border-bottom: 2px solid #004f9e; padding-bottom: 10px; margin-bottom: 20px;">
        <h2 style="margin: 0; color: #004f9e;">Safety App Notification</h2>
        <p style="margin: 0; font-size: 14px; color: #666;">${title}</p>
      </div>
      <div style="font-size: 15px; line-height: 1.6;">
        ${messageBody}
      </div>
      <div style="margin-top: 30px; font-size: 12px; color: #888;">
        <p>This is an automated message from the Safety App system.</p>
      </div>
    </div>
  `;
}

exports.sendEmail = async (to, subject, messageBody) => {
  const htmlContent = buildEmailTemplate(subject, messageBody);
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_USER,
      to,
      subject,
      html: htmlContent
    });
    console.log(`[EMAIL] Sent to ${to} | messageId: ${info.messageId}`);
  } catch (err) {
    console.error(`[EMAIL] Failed to send to ${to} | ${err.code || ""} ${err.message}`);
    throw err;
  }
};