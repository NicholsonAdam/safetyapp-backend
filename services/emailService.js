const EMAIL_FROM = process.env.EMAIL_FROM || 'muskogeeautomation@daltile.com';

// In-memory token cache — reused across calls, refreshed 1 min before expiry
let tokenCache = { token: null, expiresAt: 0 };

async function getAccessToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt - 60000) {
    return tokenCache.token;
  }

  const url = `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     process.env.AZURE_CLIENT_ID,
    client_secret: process.env.AZURE_CLIENT_SECRET,
    scope:         'https://graph.microsoft.com/.default',
  });

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OAuth2 token fetch failed: ${text}`);
  }

  const data = await res.json();
  tokenCache.token     = data.access_token;
  tokenCache.expiresAt = Date.now() + data.expires_in * 1000;
  return tokenCache.token;
}

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
  const token       = await getAccessToken();
  const htmlContent = buildEmailTemplate(subject, messageBody);

  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${EMAIL_FROM}/sendMail`, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      message: {
        subject,
        body:         { contentType: 'HTML', content: htmlContent },
        toRecipients: [{ emailAddress: { address: to } }],
      },
      saveToSentItems: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[EMAIL] Failed to ${to}: ${text}`);
    throw new Error(`Graph API sendMail failed: ${text}`);
  }

  console.log(`[EMAIL] Sent to ${to} via Graph API`);
};
