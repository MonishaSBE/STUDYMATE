/**
 * Email Service — Nodemailer with Gmail
 * Sends real-time emails for:
 *  - Chat/study partner request notifications
 *  - Request accepted notifications
 */

const nodemailer = require('nodemailer');

let transporter = null;

function isEmailConfigured() {
    return Boolean(
        process.env.GMAIL_USER &&
        process.env.GMAIL_APP_PASSWORD &&
        process.env.GMAIL_USER.trim().length > 0 &&
        process.env.GMAIL_APP_PASSWORD.trim().length > 0 &&
        process.env.GMAIL_USER !== 'your_email@gmail.com'
    );
}

function getTransporter() {
    if (!isEmailConfigured()) return null;
    if (!transporter) {
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_APP_PASSWORD
            }
        });
    }
    return transporter;
}

/**
 * Send a study partner request email to the receiver
 */
async function sendPartnerRequestEmail({ senderName, senderEmail, receiverName, receiverEmail, introMessage, acceptUrl }) {
    const transport = getTransporter();
    if (!transport) {
        console.log('[Email] Email not configured. Skipping email notification.');
        return false;
    }
    try {
        await transport.sendMail({
            from: `"StudyMate Platform" <${process.env.GMAIL_USER}>`,
            to: receiverEmail,
            subject: `📚 ${senderName} wants to study with you on StudyMate!`,
            html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
  body { font-family: 'Segoe UI', sans-serif; background: #f4f6f9; margin: 0; padding: 0; }
  .container { max-width: 560px; margin: 30px auto; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
  .header { background: linear-gradient(135deg, #1e3a5f 0%, #2f8f8a 100%); padding: 32px 30px; text-align: center; }
  .header h1 { color: #f2b705; font-size: 24px; margin: 0 0 6px; }
  .header p { color: rgba(255,255,255,0.85); font-size: 14px; margin: 0; }
  .body { padding: 30px; }
  .avatar { width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, #2f8f8a, #1e3a5f); color: #f2b705; font-size: 22px; font-weight: 700; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; text-align: center; line-height: 56px; }
  .message-box { background: #f8f9fb; border-left: 4px solid #2f8f8a; border-radius: 6px; padding: 14px 16px; margin: 18px 0; font-style: italic; color: #444; font-size: 14px; }
  .btn { display: inline-block; background: #2f8f8a; color: #fff !important; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 15px; margin: 10px 6px 0; }
  .btn.secondary { background: #eee; color: #555 !important; }
  .footer { text-align: center; padding: 20px; background: #f4f6f9; font-size: 12px; color: #888; }
</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>🎓 StudyMate</h1>
    <p>Academic Study Partner Platform</p>
  </div>
  <div class="body">
    <div style="text-align:center;">
      <div class="avatar" style="line-height:56px; margin:0 auto 12px; width:56px; height:56px;">${senderName.charAt(0).toUpperCase()}</div>
      <h2 style="margin:0 0 6px; font-size:20px; color:#1e3a5f;">${escapeHtml(senderName)}</h2>
      <p style="color:#666; font-size:13px; margin:0;">wants to be your study partner on StudyMate!</p>
    </div>

    <p style="margin-top:20px; font-size:14px; color:#333;">Hi <strong>${escapeHtml(receiverName)}</strong>,</p>
    <p style="font-size:14px; color:#555; line-height:1.6;">
      Your classmate <strong>${escapeHtml(senderName)}</strong> has sent you a study partner request on StudyMate.
      Once you accept, you'll be able to chat, coordinate study sessions, and share notes directly on the platform.
    </p>

    ${introMessage ? `<div class="message-box">💬 "${escapeHtml(introMessage)}"</div>` : ''}

    <div style="text-align:center; margin-top:24px;">
      <p style="font-size:13px; color:#666;">Log in to StudyMate to accept or decline this request:</p>
      <a href="${(process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '')}/dashboard.html" class="btn">Open StudyMate & Respond →</a>
    </div>
  </div>
  <div class="footer">
    StudyMate Academic Platform · This email was sent because someone sent you a study partner request.<br>
    If you didn't expect this, you can safely ignore it.
  </div>
</div>
</body></html>
            `
        });
        console.log(`[Email] Partner request email sent to ${receiverEmail}`);
        return true;
    } catch (err) {
        console.error('[Email] Failed to send partner request email:', err.message);
        return false;
    }
}

/**
 * Send a "request accepted" notification email to the original sender
 */
async function sendRequestAcceptedEmail({ accepterName, senderName, senderEmail, dashboardUrl }) {
    const transport = getTransporter();
    if (!transport) return false;
    try {
        await transport.sendMail({
            from: `"StudyMate Platform" <${process.env.GMAIL_USER}>`,
            to: senderEmail,
            subject: `🎉 ${accepterName} accepted your study partner request!`,
            html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
  body { font-family: 'Segoe UI', sans-serif; background: #f4f6f9; margin: 0; padding: 0; }
  .container { max-width: 560px; margin: 30px auto; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
  .header { background: linear-gradient(135deg, #1e3a5f 0%, #2f8f8a 100%); padding: 32px 30px; text-align: center; }
  .header h1 { color: #f2b705; font-size: 24px; margin: 0 0 6px; }
  .btn { display: inline-block; background: #2f8f8a; color: #fff !important; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 15px; margin-top: 18px; }
  .footer { text-align: center; padding: 20px; background: #f4f6f9; font-size: 12px; color: #888; }
</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>🎓 StudyMate</h1>
  </div>
  <div style="padding:30px; text-align:center;">
    <div style="font-size:48px; margin-bottom:12px;">🎉</div>
    <h2 style="color:#1e3a5f; margin:0 0 10px;">You've got a new study partner!</h2>
    <p style="color:#555; font-size:14px;">Hi <strong>${escapeHtml(senderName)}</strong>, <strong>${escapeHtml(accepterName)}</strong> accepted your study partner request. You can now chat and coordinate study sessions directly on StudyMate.</p>
    <a href="${dashboardUrl || ((process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '') + '/dashboard.html')}" class="btn">Go to StudyMate Chat →</a>
  </div>
  <div class="footer">StudyMate Academic Platform</div>
</div>
</body></html>
            `
        });
        console.log(`[Email] Accepted notification sent to ${senderEmail}`);
        return true;
    } catch (err) {
        console.error('[Email] Failed to send accepted email:', err.message);
        return false;
    }
}

function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
}

module.exports = { isEmailConfigured, sendPartnerRequestEmail, sendRequestAcceptedEmail };
