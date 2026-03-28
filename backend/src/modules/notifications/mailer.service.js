import nodemailer from 'nodemailer';

let transporter = null;

export function isEmailTransportConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function readSmtpPassword() {
  return String(process.env.SMTP_PASS || '').replace(/\s+/g, '');
}

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  if (isEmailTransportConfigured()) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || 'false') === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: readSmtpPassword(),
      },
    });
  } else {
    transporter = nodemailer.createTransport({ jsonTransport: true });
  }

  return transporter;
}

async function sendMail({ to, subject, html, text }) {
  return getTransporter().sendMail({
    from: process.env.EMAIL_FROM || 'Smart Agriculture <no-reply@smartagri.local>',
    to,
    subject,
    html,
    text,
  });
}

export async function sendEmail({ to, subject, text, html, category = 'system' }) {
  const response = await sendMail({ to, subject, html, text });
  return {
    to,
    subject,
    category,
    transport: isEmailTransportConfigured() ? 'smtp' : 'jsonTransport',
    messageId: response?.messageId || null,
  };
}

export async function sendOTPEmail(email, otp) {
  const message = `Your OTP is ${otp}. It will expire in 5 minutes.`;
  return sendMail({
    to: email,
    subject: 'Smart Agriculture OTP verification',
    text: message,
    html: `
      <div style="font-family:Arial,sans-serif;padding:24px;background:#f4f8ef;color:#1f3a1a">
        <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:24px;border:1px solid #d8e7cf">
          <p style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:0.2em;color:#6c8d57">Smart Agriculture</p>
          <h1 style="margin:0 0 12px;font-size:28px;color:#1f3a1a">OTP Verification</h1>
          <p style="margin:0 0 18px;font-size:16px;color:#466146">Your OTP is:</p>
          <div style="font-size:32px;font-weight:700;letter-spacing:0.25em;color:#ff7a1a">${otp}</div>
          <p style="margin:18px 0 0;font-size:14px;color:#5e765d">This code expires in 5 minutes.</p>
        </div>
      </div>
    `,
  });
}

export async function sendAccountChangeAlert(email, action) {
  const message = `Your account ${action}. If this was not you, contact the platform administrator immediately.`;
  return sendMail({
    to: email,
    subject: 'Smart Agriculture account change alert',
    text: message,
    html: `
      <div style="font-family:Arial,sans-serif;padding:24px;background:#f4f8ef;color:#1f3a1a">
        <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:24px;border:1px solid #d8e7cf">
          <p style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:0.2em;color:#6c8d57">Smart Agriculture</p>
          <h1 style="margin:0 0 12px;font-size:28px;color:#1f3a1a">Account change alert</h1>
          <p style="margin:0;font-size:16px;color:#466146">${message}</p>
        </div>
      </div>
    `,
  });
}

export async function sendSystemEmail({ email, subject, title, message }) {
  return sendMail({
    to: email,
    subject,
    text: `${title}\n\n${message}`,
    html: `
      <div style="font-family:Arial,sans-serif;padding:24px;background:#f4f8ef;color:#1f3a1a">
        <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:24px;border:1px solid #d8e7cf">
          <p style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:0.2em;color:#6c8d57">Smart Agriculture</p>
          <h1 style="margin:0 0 12px;font-size:24px;color:#1f3a1a">${title}</h1>
          <p style="margin:0;font-size:16px;color:#466146;line-height:1.6">${message}</p>
        </div>
      </div>
    `,
  });
}
