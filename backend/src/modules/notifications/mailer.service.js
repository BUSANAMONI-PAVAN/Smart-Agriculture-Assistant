import nodemailer from 'nodemailer';
import { appendEmailLog } from '../admin/email.store.js';

let transporter = null;
const LEGACY_ADMIN_EMAIL = 'peeter.test.1774896605@gmail.com';
const RECOVERY_ADMIN_EMAIL = 'endless.candate@gmail.com';

function normalizeEnvValue(value) {
  return String(value || '').trim();
}

function extractEmailAddress(value) {
  const trimmed = normalizeEnvValue(value);
  if (!trimmed) {
    return '';
  }

  const markdownMailtoMatch = trimmed.match(/\[[^\]]*?([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})[^\]]*]\(mailto:[^)]+\)/i);
  if (markdownMailtoMatch) {
    return markdownMailtoMatch[1].trim();
  }

  const angleBracketMatch = trimmed.match(/<([^>]+@[^>]+)>/);
  if (angleBracketMatch) {
    return angleBracketMatch[1].trim();
  }

  const plainEmailMatch = trimmed.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return plainEmailMatch ? plainEmailMatch[0].trim() : trimmed;
}

function normalizeFromHeader(value) {
  const trimmed = normalizeEnvValue(value);
  if (!trimmed) {
    return 'Smart Agriculture <no-reply@smartagri.local>';
  }

  const markdownMatch = trimmed.match(/^(.*?)\s*\[[^\]]*?([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})[^\]]*]\(mailto:[^)]+\)\s*$/i);
  if (markdownMatch) {
    const name = markdownMatch[1].replace(/^"+|"+$/g, '').trim();
    const email = markdownMatch[2].trim();
    return name ? `${name} <${email}>` : email;
  }

  const angleBracketMatch = trimmed.match(/^(.*?)<([^>]+@[^>]+)>$/);
  if (angleBracketMatch) {
    const name = angleBracketMatch[1].replace(/^"+|"+$/g, '').trim();
    const email = angleBracketMatch[2].trim();
    return name ? `${name} <${email}>` : email;
  }

  const email = extractEmailAddress(trimmed);
  if (email && email !== trimmed) {
    const name = trimmed.replace(email, '').replace(/[<>\[\]()]/g, '').replace(/mailto:/gi, '').trim();
    return name ? `${name} <${email}>` : email;
  }

  return trimmed;
}

function remapLegacyRecipientEmail(email) {
  const normalized = extractEmailAddress(email).toLowerCase();
  if (normalized !== LEGACY_ADMIN_EMAIL) {
    return extractEmailAddress(email);
  }
  return RECOVERY_ADMIN_EMAIL;
}

function readSmtpPassword() {
  return normalizeEnvValue(process.env.SMTP_PASS).replace(/\s+/g, '');
}

function readSmtpUser() {
  return extractEmailAddress(process.env.SMTP_USER);
}

function readSmtpService() {
  return normalizeEnvValue(process.env.SMTP_SERVICE);
}

function readSmtpHost() {
  return normalizeEnvValue(process.env.SMTP_HOST);
}

function readPositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

function readSmtpTimeouts() {
  return {
    connectionTimeout: readPositiveInteger(process.env.SMTP_CONNECTION_TIMEOUT_MS, 10000),
    greetingTimeout: readPositiveInteger(process.env.SMTP_GREETING_TIMEOUT_MS, 10000),
    socketTimeout: readPositiveInteger(process.env.SMTP_SOCKET_TIMEOUT_MS, 20000),
    sendTimeout: readPositiveInteger(process.env.SMTP_SEND_TIMEOUT_MS, 25000),
  };
}

export function isEmailTransportConfigured() {
  const service = readSmtpService();
  const host = readSmtpHost();
  const user = readSmtpUser();
  const pass = readSmtpPassword();

  return Boolean((service || host) && user && pass);
}

function buildTransportOptions() {
  if (!isEmailTransportConfigured()) {
    return null;
  }

  const service = readSmtpService();
  const user = readSmtpUser();
  const pass = readSmtpPassword();
  const timeouts = readSmtpTimeouts();

  if (service) {
    return {
      service,
      connectionTimeout: timeouts.connectionTimeout,
      greetingTimeout: timeouts.greetingTimeout,
      socketTimeout: timeouts.socketTimeout,
      auth: {
        user,
        pass,
      },
    };
  }

  return {
    host: readSmtpHost(),
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    connectionTimeout: timeouts.connectionTimeout,
    greetingTimeout: timeouts.greetingTimeout,
    socketTimeout: timeouts.socketTimeout,
    auth: {
      user,
      pass,
    },
  };
}

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  const transportOptions = buildTransportOptions();
  if (!transportOptions) {
    return null;
  }

  transporter = nodemailer.createTransport(transportOptions);
  return transporter;
}

function summarizeDelivery(response) {
  const accepted = Array.isArray(response?.accepted)
    ? response.accepted
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    : [];
  const rejected = Array.isArray(response?.rejected)
    ? response.rejected
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    : [];
  const delivered = accepted.length > 0 && rejected.length === 0;

  if (delivered) {
    return {
      delivered: true,
      errorMessage: null,
    };
  }

  if (rejected.length > 0) {
    return {
      delivered: false,
      errorMessage: `SMTP rejected recipient(s): ${rejected.join(', ')}.`,
    };
  }

  return {
    delivered: false,
    errorMessage: 'SMTP accepted the request, but no recipient delivery was confirmed.',
  };
}

function buildPayloadPreview(text, html, category) {
  if (category === 'otp') {
    return 'OTP verification email generated for secure admin verification.';
  }

  const rawPreview = String(text || html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\b\d{6}\b/g, '******')
    .replace(/\s+/g, ' ')
    .trim();

  return rawPreview.slice(0, 280);
}

async function persistEmailLog(entry) {
  try {
    return await appendEmailLog(entry);
  } catch (error) {
    console.error('Email log write failed', {
      to: entry.to,
      subject: entry.subject,
      error: error?.message || String(error),
    });
    return null;
  }
}

async function sendMail({ to, subject, html, text, category = 'system' }) {
  const normalizedTo = remapLegacyRecipientEmail(to);
  const normalizedSubject = String(subject || '').trim() || 'Smart Agriculture notification';
  const payloadPreview = buildPayloadPreview(text, html, category);

  if (!normalizedTo) {
    const failedEntry = {
      to: '',
      subject: normalizedSubject,
      category,
      transport: 'disabled',
      messageId: null,
      delivered: false,
      errorMessage: 'Recipient email address is missing.',
      payloadPreview,
    };
    const emailLog = await persistEmailLog(failedEntry);
    return { ...failedEntry, id: emailLog?.id || null, createdAt: emailLog?.createdAt || null };
  }

  if (!isEmailTransportConfigured()) {
    const failedEntry = {
      to: normalizedTo,
      subject: normalizedSubject,
      category,
      transport: 'disabled',
      messageId: null,
      delivered: false,
      errorMessage: 'SMTP is not configured. Set SMTP_SERVICE or SMTP_HOST with SMTP_USER, SMTP_PASS, and EMAIL_FROM.',
      payloadPreview,
    };
    const emailLog = await persistEmailLog(failedEntry);
    return { ...failedEntry, id: emailLog?.id || null, createdAt: emailLog?.createdAt || null };
  }

  try {
    const transporterInstance = getTransporter();
    const sendTimeoutMs = readSmtpTimeouts().sendTimeout;
    let sendTimeoutId = null;
    const sendTimeoutPromise = new Promise((_, reject) => {
      sendTimeoutId = setTimeout(() => {
        reject(new Error(`SMTP send timed out after ${sendTimeoutMs}ms.`));
      }, sendTimeoutMs);
    });

    const response = await Promise.race([
      transporterInstance.sendMail({
        from: normalizeFromHeader(process.env.EMAIL_FROM),
        to: normalizedTo,
        subject: normalizedSubject,
        html,
        text,
      }),
      sendTimeoutPromise,
    ]).finally(() => {
      if (sendTimeoutId) {
        clearTimeout(sendTimeoutId);
      }
    });
    const delivery = summarizeDelivery(response);

    const deliveredEntry = {
      to: normalizedTo,
      subject: normalizedSubject,
      category,
      transport: 'smtp',
      messageId: response?.messageId || null,
      delivered: delivery.delivered,
      errorMessage: delivery.errorMessage,
      payloadPreview,
    };
    const emailLog = await persistEmailLog(deliveredEntry);
    return { ...deliveredEntry, id: emailLog?.id || null, createdAt: emailLog?.createdAt || null };
  } catch (error) {
    console.error('Email delivery failed', {
      to: normalizedTo,
      subject: normalizedSubject,
      transport: 'smtp',
      error: error?.message || String(error),
    });

    const failedEntry = {
      to: normalizedTo,
      subject: normalizedSubject,
      category,
      transport: 'smtp',
      messageId: null,
      delivered: false,
      errorMessage: error?.message || 'Unknown email delivery error.',
      payloadPreview,
    };
    const emailLog = await persistEmailLog(failedEntry);
    return { ...failedEntry, id: emailLog?.id || null, createdAt: emailLog?.createdAt || null };
  }
}

export async function sendEmail({ to, subject, text, html, category = 'system' }) {
  return sendMail({ to, subject, html, text, category });
}

export async function sendOTPEmail(email, otp) {
  const message = `Your OTP is ${otp}. It will expire in 5 minutes.`;
  return sendMail({
    to: email,
    subject: 'Smart Agriculture OTP verification',
    category: 'otp',
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
    category: 'account-change',
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

export async function sendSystemEmail({ email, subject, title, message, category = 'system' }) {
  return sendMail({
    to: email,
    subject,
    category,
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
