import { getUserRecordById } from '../auth/auth.store.js';
import { addAlert, shouldStoreAlert } from '../alerts/alerts.store.js';
import { sendEmail } from './mailer.service.js';

function renderEmailBody(title, message, cta = '') {
  return `
    <div style="font-family:Arial,sans-serif;background:#f5f1e8;padding:24px;color:#17321f">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;padding:24px;border:1px solid #d5e3cf">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#62864e">Smart Agriculture</p>
        <h1 style="margin:0 0 12px;font-size:28px;color:#17321f">${title}</h1>
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#36503f">${message}</p>
        ${cta ? `<p style="margin:0;font-size:14px;color:#4e6a57">${cta}</p>` : ''}
      </div>
    </div>
  `;
}

export async function notifyUser({
  userId,
  type = 'lifecycle',
  level = 'medium',
  title,
  message,
  source = 'system',
  metadata = {},
  sendEmailNotice = false,
  emailSubject = title,
}) {
  const alertPayload = {
    userId,
    type,
    level,
    title,
    message,
    source,
    metadata,
  };

  let alert = null;
  if (shouldStoreAlert(alertPayload)) {
    alert = await addAlert(alertPayload);
  }

  const user = await getUserRecordById(userId);
  let emailLog = null;
  if (sendEmailNotice && user?.email && user.role === 'admin') {
    emailLog = await sendEmail({
      to: user.email,
      subject: emailSubject,
      text: `${title}\n\n${message}`,
      html: renderEmailBody(title, message, user.phone ? `Registered phone on file: ${user.phone}` : ''),
      category: source,
    });
  }

  return {
    alert,
    emailLog,
    contact: user
      ? {
          email: user.email,
          phone: user.phone,
        }
      : null,
  };
}
