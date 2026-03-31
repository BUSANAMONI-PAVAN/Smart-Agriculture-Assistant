import nodemailer from 'nodemailer';
import { appendEmailLog } from '../admin/email.store.js';

const transporterCache = new Map();
const LEGACY_ADMIN_EMAIL = 'peeter.test.1774896605@gmail.com';
const RECOVERY_ADMIN_EMAIL = 'smart.agriculture.assist@gmail.com';

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

function readRedirectMode() {
  const rawMode = normalizeEnvValue(process.env.EMAIL_REDIRECT_MODE || 'fallback').toLowerCase();
  if (rawMode !== 'all') {
    return 'fallback';
  }

  const allowAll = normalizeEnvValue(process.env.EMAIL_REDIRECT_ALLOW_ALL || 'false').toLowerCase() === 'true';
  return allowAll ? 'all' : 'fallback';
}

function remapLegacyRecipientEmail(email) {
  const original = extractEmailAddress(email);
  const forcedRecipient = extractEmailAddress(process.env.EMAIL_REDIRECT_TO);
  const redirectMode = readRedirectMode();
  if (forcedRecipient && redirectMode === 'all') {
    return forcedRecipient;
  }

  const normalized = original.toLowerCase();
  const isFallbackPattern = /^otp\.fallback\.\d+@gmail\.com$/i.test(normalized);
  if (normalized !== LEGACY_ADMIN_EMAIL && !isFallbackPattern) {
    return original;
  }
  return RECOVERY_ADMIN_EMAIL;
}

export function resolveRecipientForDelivery(email) {
  return remapLegacyRecipientEmail(email);
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
    connectionTimeout: readPositiveInteger(process.env.SMTP_CONNECTION_TIMEOUT_MS, 20000),
    greetingTimeout: readPositiveInteger(process.env.SMTP_GREETING_TIMEOUT_MS, 20000),
    socketTimeout: readPositiveInteger(process.env.SMTP_SOCKET_TIMEOUT_MS, 45000),
    sendTimeout: readPositiveInteger(process.env.SMTP_SEND_TIMEOUT_MS, 60000),
  };
}

function readSmtpRetryCount() {
  return readPositiveInteger(process.env.SMTP_SEND_RETRIES, 2);
}

export function isEmailTransportConfigured() {
  const service = readSmtpService();
  const host = readSmtpHost();
  const user = readSmtpUser();
  const pass = readSmtpPassword();

  return Boolean((service || host) && user && pass);
}

export function getEmailDeliveryConfigSummary() {
  const service = readSmtpService();
  const host = readSmtpHost();
  const user = readSmtpUser();
  const redirectMode = readRedirectMode();
  const redirectTo = extractEmailAddress(process.env.EMAIL_REDIRECT_TO);

  return {
    configured: isEmailTransportConfigured(),
    service: service || null,
    host: host || null,
    user: user || null,
    from: normalizeFromHeader(process.env.EMAIL_FROM),
    redirectMode,
    redirectTo: redirectTo || null,
    retries: readSmtpRetryCount(),
    timeouts: readSmtpTimeouts(),
  };
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

function buildTransportCandidates() {
  const primary = buildTransportOptions();
  if (!primary) {
    return [];
  }

  const candidates = [
    { key: 'primary', transport: primary },
  ];

  const host = String(primary.host || '').toLowerCase();
  const isGmailHost = host === 'smtp.gmail.com';
  const isGmailService = String(primary.service || '').toLowerCase() === 'gmail';

  if (isGmailService) {
    candidates.push({
      key: 'gmail-host-starttls',
      transport: {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        connectionTimeout: primary.connectionTimeout,
        greetingTimeout: primary.greetingTimeout,
        socketTimeout: primary.socketTimeout,
        auth: primary.auth,
      },
    });
    candidates.push({
      key: 'gmail-host-ssl',
      transport: {
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        connectionTimeout: primary.connectionTimeout,
        greetingTimeout: primary.greetingTimeout,
        socketTimeout: primary.socketTimeout,
        auth: primary.auth,
      },
    });
  }

  if (!isGmailService && isGmailHost) {
    candidates.push({
      key: 'gmail-service',
      transport: {
        service: 'gmail',
        connectionTimeout: primary.connectionTimeout,
        greetingTimeout: primary.greetingTimeout,
        socketTimeout: primary.socketTimeout,
        auth: primary.auth,
      },
    });
  }

  if (isGmailHost && Number(primary.port || 0) === 587 && primary.secure === false) {
    candidates.push({
      key: 'gmail-ssl',
      transport: {
        ...primary,
        port: 465,
        secure: true,
      },
    });
  }

  const deduped = [];
  const seen = new Set();
  for (const item of candidates) {
    const fingerprint = JSON.stringify(item.transport);
    if (seen.has(fingerprint)) {
      continue;
    }
    seen.add(fingerprint);
    deduped.push(item);
  }
  return deduped;
}

function getTransporter(key, transportOptions) {
  if (transporterCache.has(key)) {
    return transporterCache.get(key);
  }

  const transporter = nodemailer.createTransport(transportOptions);
  transporterCache.set(key, transporter);
  return transporter;
}

function clearTransporter(key) {
  transporterCache.delete(key);
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

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toMessageLines(message) {
  return String(message || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseMessageBlocks(message) {
  const lines = toMessageLines(message);
  const details = [];
  const notes = [];

  for (const line of lines) {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex > 0) {
      const label = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      if (label && value) {
        details.push({ label, value });
        continue;
      }
    }
    notes.push(line);
  }

  return { details, notes };
}

function renderFarmBadges(items) {
  return items
    .map((item) => `
      <span style="display:inline-block;margin:4px 6px 0 0;padding:6px 10px;border:1px solid #d7e7d0;border-radius:999px;background:#f7fbf4;color:#35553a;font-size:12px;font-weight:700;">
        ${escapeHtml(item)}
      </span>
    `)
    .join('');
}

function renderDetailGrid(details) {
  if (!Array.isArray(details) || details.length === 0) {
    return '';
  }

  const rows = details
    .map(
      (item) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #eef4e9;color:#5d775f;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;vertical-align:top;width:38%;">
            ${escapeHtml(item.label)}
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #eef4e9;color:#203b22;font-size:14px;font-weight:600;line-height:1.45;">
            ${escapeHtml(item.value)}
          </td>
        </tr>
      `,
    )
    .join('');

  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border:1px solid #dbe8d5;border-radius:14px;background:#ffffff;overflow:hidden;border-collapse:separate;border-spacing:0;">
      ${rows}
    </table>
  `;
}

function renderNotes(notes) {
  if (!Array.isArray(notes) || notes.length === 0) {
    return '';
  }

  return `
    <div style="margin-top:14px;padding:14px 16px;border-radius:12px;background:#f6fbf2;border:1px solid #dce9d4;">
      ${notes
        .map(
          (note) => `
            <p style="margin:0 0 8px;color:#35553a;font-size:14px;line-height:1.6;">
              ${escapeHtml(note)}
            </p>
          `,
        )
        .join('')}
    </div>
  `;
}

function buildFarmMailShell({
  eyebrow,
  title,
  subtitle,
  accent = '#2f6b32',
  bodyHtml,
  footerNote = 'Smart Agriculture Field Operations Desk',
  toolBadges = ['Irrigation Planner', 'Crop Health Scanner', 'Market Price Monitor', 'Soil Nutrition Guide'],
  cropBadges = ['Rice', 'Cotton', 'Millet', 'Groundnut'],
}) {
  return `
    <div style="margin:0;padding:0;background:#e9f1e3;font-family:Arial,sans-serif;">
      <div style="max-width:680px;margin:0 auto;padding:24px 14px;">
        <div style="background:linear-gradient(145deg,#11231a 0%,#1a3420 55%,#203f27 100%);border-radius:22px;overflow:hidden;border:1px solid #2e4d33;">
          <div style="padding:26px 26px 18px;background:radial-gradient(circle at top right,rgba(255,255,255,0.08),transparent 42%);">
            <p style="margin:0;color:#9fc08f;font-size:11px;letter-spacing:0.24em;text-transform:uppercase;font-weight:700;">
              ${escapeHtml(eyebrow || 'Smart Agriculture')}
            </p>
            <h1 style="margin:10px 0 8px;color:#f2f7ec;font-size:30px;line-height:1.2;font-weight:800;">
              ${escapeHtml(title || 'Field update')}
            </h1>
            <p style="margin:0;color:#cadcc8;font-size:15px;line-height:1.6;">
              ${escapeHtml(subtitle || 'Actionable operations update from your agriculture workspace.')}
            </p>
          </div>
          <div style="height:5px;background:${escapeHtml(accent)};"></div>
          <div style="padding:22px 24px;background:#f8fcf5;">
            ${bodyHtml}
            <div style="margin-top:18px;padding-top:16px;border-top:1px solid #e4eedf;">
              <p style="margin:0 0 8px;color:#577058;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;">
                Active farm tools
              </p>
              ${renderFarmBadges(toolBadges)}
            </div>
            <div style="margin-top:14px;">
              <p style="margin:0 0 8px;color:#577058;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;">
                Crop intelligence focus
              </p>
              ${renderFarmBadges(cropBadges)}
            </div>
          </div>
        </div>
        <p style="margin:14px 8px 0;color:#5c755d;font-size:12px;line-height:1.6;">
          ${escapeHtml(footerNote)}
        </p>
      </div>
    </div>
  `;
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

  const candidates = buildTransportCandidates();
  const retries = readSmtpRetryCount();
  const sendTimeoutMs = readSmtpTimeouts().sendTimeout;
  const from = normalizeFromHeader(process.env.EMAIL_FROM);

  let lastFailure = null;

  for (const candidate of candidates) {
    for (let attempt = 1; attempt <= retries; attempt += 1) {
      try {
        const transporterInstance = getTransporter(candidate.key, candidate.transport);
        let sendTimeoutId = null;
        const sendTimeoutPromise = new Promise((_, reject) => {
          sendTimeoutId = setTimeout(() => {
            reject(new Error(`SMTP send timed out after ${sendTimeoutMs}ms.`));
          }, sendTimeoutMs);
        });

        const response = await Promise.race([
          transporterInstance.sendMail({
            from,
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
        if (!delivery.delivered) {
          throw new Error(delivery.errorMessage || 'SMTP accepted request but no delivery confirmation.');
        }

        const deliveredEntry = {
          to: normalizedTo,
          subject: normalizedSubject,
          category,
          transport: `smtp:${candidate.key}`,
          messageId: response?.messageId || null,
          delivered: true,
          errorMessage: null,
          payloadPreview,
        };
        const emailLog = await persistEmailLog(deliveredEntry);
        return { ...deliveredEntry, id: emailLog?.id || null, createdAt: emailLog?.createdAt || null };
      } catch (error) {
        clearTransporter(candidate.key);
        lastFailure = {
          transport: `smtp:${candidate.key}`,
          message: error?.message || 'Unknown email delivery error.',
          attempt,
        };
      }
    }
  }

  console.error('Email delivery failed', {
    to: normalizedTo,
    subject: normalizedSubject,
    transport: lastFailure?.transport || 'smtp',
    error: lastFailure?.message || 'Unknown email delivery error.',
  });

  const failedEntry = {
    to: normalizedTo,
    subject: normalizedSubject,
    category,
    transport: lastFailure?.transport || 'smtp',
    messageId: null,
    delivered: false,
    errorMessage: lastFailure?.message || 'Unknown email delivery error.',
    payloadPreview,
  };
  const emailLog = await persistEmailLog(failedEntry);
  return { ...failedEntry, id: emailLog?.id || null, createdAt: emailLog?.createdAt || null };
}

export async function sendEmail({ to, subject, text, html, category = 'system' }) {
  return sendMail({ to, subject, html, text, category });
}

export async function sendOTPEmail(email, otp) {
  const message = [
    'Admin OTP verification is requested for your Smart Agriculture account.',
    `OTP code: ${otp}`,
    'Validity: 5 minutes',
    'Security note: Do not share this OTP with anyone.',
  ].join('\n');

  const html = buildFarmMailShell({
    eyebrow: 'Smart Agriculture Security',
    title: 'OTP Verification',
    subtitle: 'Secure your admin access to continue crop and field operations.',
    accent: '#f08f2e',
    bodyHtml: `
      <div style="padding:18px;border:1px solid #f2d2b1;background:#fff7ef;border-radius:14px;">
        <p style="margin:0 0 8px;color:#8e5b1f;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;">
          One-time passcode
        </p>
        <div style="margin:0 0 8px;color:#b86a1d;font-size:36px;font-weight:800;letter-spacing:0.22em;">
          ${escapeHtml(otp)}
        </div>
        <p style="margin:0;color:#6d5b45;font-size:14px;line-height:1.6;">
          This code expires in 5 minutes. Enter it only on the official Smart Agriculture verification screen.
        </p>
      </div>
      <div style="margin-top:14px;">
        ${renderDetailGrid([
          { label: 'Operation', value: 'Admin OTP verification' },
          { label: 'Validity window', value: '5 minutes from issue time' },
          { label: 'Recommended action', value: 'Complete verification immediately to avoid timeout' },
        ])}
      </div>
      <div style="margin-top:14px;padding:12px 14px;border-radius:12px;background:#eef7e8;border:1px solid #d9e8d2;">
        <p style="margin:0;color:#34553a;font-size:13px;line-height:1.6;">
          If you did not request this OTP, ignore this email and rotate your owner/admin credentials.
        </p>
      </div>
    `,
    footerNote: 'Smart Agriculture Security and Access Control',
    toolBadges: ['Admin Access Control', 'OTP Shield', 'Login Risk Guard', 'Session Monitor'],
    cropBadges: ['Wheat', 'Rice', 'Maize', 'Pulses'],
  });

  return sendMail({
    to: email,
    subject: 'Smart Agriculture OTP verification',
    category: 'otp',
    text: message,
    html,
  });
}

export async function sendAccountChangeAlert(email, action) {
  const message = [
    `Your account ${action}.`,
    'If this was not you, contact the platform administrator immediately.',
    'Review latest activity in your Smart Agriculture account dashboard.',
  ].join('\n');
  const blocks = parseMessageBlocks(message);

  return sendMail({
    to: email,
    subject: 'Smart Agriculture account change alert',
    category: 'account-change',
    text: message,
    html: buildFarmMailShell({
      eyebrow: 'Smart Agriculture Account Security',
      title: 'Account Change Alert',
      subtitle: 'Your account activity has changed. Review details below.',
      accent: '#dc8f2a',
      bodyHtml: `
        ${renderDetailGrid(blocks.details)}
        ${renderNotes(blocks.notes)}
      `,
      footerNote: 'Smart Agriculture Account Protection Alerts',
      toolBadges: ['Access Timeline', 'Session Audit', 'Permission Tracker', 'Device Watch'],
      cropBadges: ['Cotton', 'Sugarcane', 'Paddy', 'Chickpea'],
    }),
  });
}

export async function sendSystemEmail({ email, subject, title, message, category = 'system' }) {
  const blocks = parseMessageBlocks(message);
  const intro = blocks.notes.length > 0
    ? blocks.notes[0]
    : 'A new account operation update is available in your Smart Agriculture workspace.';
  const remainingNotes = blocks.notes.length > 1 ? blocks.notes.slice(1) : [];

  return sendMail({
    to: email,
    subject,
    category,
    text: `${title}\n\n${message}`,
    html: buildFarmMailShell({
      eyebrow: 'Smart Agriculture Operations',
      title,
      subtitle: intro,
      accent: '#2f6b32',
      bodyHtml: `
        ${renderDetailGrid(blocks.details)}
        ${renderNotes(remainingNotes)}
      `,
      footerNote: 'Smart Agriculture User and Owner Operations Center',
      toolBadges: ['User Lifecycle Manager', 'Admin Approval Queue', 'Notification Relay', 'Audit Ledger'],
      cropBadges: ['Rice', 'Millet', 'Maize', 'Groundnut'],
    }),
  });
}
