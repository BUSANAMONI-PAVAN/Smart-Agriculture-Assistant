import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import {
  ensureOwnerAdmin,
  getUserById,
  listUsers,
  updateUserByAdmin,
} from '../auth/auth.store.js';
import { issueAccessToken, verifyToken } from '../auth/token.service.js';
import { listFeatureFlags } from '../admin/feature.store.js';
import {
  getEmailDeliveryConfigSummary,
  isEmailTransportConfigured,
  resolveRecipientForDelivery,
  sendSystemEmail,
} from '../notifications/mailer.service.js';
import { validateRequest } from '../../lib/validate.js';
import { AppError } from '../../lib/errors.js';

const router = Router();

const ownerSessionSchema = z.object({
  ownerSecret: z.string().trim().min(8).optional(),
}).strict();

const ownerLoginSchema = z.object({
  name: z.string().trim().min(1).max(120),
  password: z.string().trim().min(1).max(120),
}).strict();

const ownerPendingActionSchema = z.object({
  ownerSecret: z.string().trim().min(8).optional(),
}).strict();

const idParamSchema = z.object({
  id: z.string().trim().min(3).max(64),
});

const ownerMailTestSchema = z.object({
  ownerSecret: z.string().trim().min(8).optional(),
  email: z.string().trim().email(),
  subject: z.string().trim().min(3).max(180).optional(),
  message: z.string().trim().min(3).max(2000).optional(),
}).strict();

function readOwnerSecret(req) {
  const headerSecret = req.headers['x-owner-secret'];
  if (typeof headerSecret === 'string' && headerSecret.trim()) {
    return headerSecret.trim();
  }
  if (typeof req.body?.ownerSecret === 'string' && req.body.ownerSecret.trim()) {
    return req.body.ownerSecret.trim();
  }
  if (typeof req.query?.ownerSecret === 'string' && req.query.ownerSecret.trim()) {
    return req.query.ownerSecret.trim();
  }
  return '';
}

function ownerModuleEnabled() {
  return String(process.env.OWNER_MODULE_ENABLED || 'false').toLowerCase() === 'true';
}

function ownerAllowedInProduction() {
  return String(process.env.OWNER_MODULE_ALLOW_PRODUCTION || 'false').toLowerCase() === 'true';
}

function ownerConfiguredSecret() {
  return String(process.env.OWNER_MODULE_SECRET || '').trim();
}

function ownerEmail() {
  return String(process.env.OWNER_EMAIL || process.env.SMTP_USER || '').trim().toLowerCase();
}

function ownerName() {
  return String(process.env.OWNER_NAME || 'Owner').trim() || 'Owner';
}

function ownerLoginName() {
  return String(process.env.OWNER_LOGIN_NAME || 'peeter').trim().toLowerCase();
}

function ownerLoginPassword() {
  return String(process.env.OWNER_LOGIN_PASSWORD || 'peeter');
}

function compareSecrets(input, expected) {
  const left = Buffer.from(String(input || ''));
  const right = Buffer.from(String(expected || ''));
  if (left.length !== right.length || left.length === 0) {
    return false;
  }
  return timingSafeEqual(left, right);
}

function ensureOwnerModuleAvailable() {
  if (!ownerModuleEnabled()) {
    throw new AppError(404, 'Not found.');
  }
  if (process.env.NODE_ENV === 'production' && !ownerAllowedInProduction()) {
    throw new AppError(404, 'Not found.');
  }
}

function readAuthToken(req) {
  const header = String(req.headers.authorization || '');
  if (header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  return '';
}

async function readOwnerUserFromToken(req) {
  const token = readAuthToken(req);
  if (!token) {
    return null;
  }

  try {
    const payload = verifyToken(token);
    if (payload?.type !== 'access' || typeof payload.sub !== 'string') {
      return null;
    }

    const user = await getUserById(payload.sub);
    if (!user || user.role !== 'admin' || user.status !== 'active') {
      return null;
    }

    const configuredOwnerEmail = ownerEmail();
    if (configuredOwnerEmail && String(user.email || '').trim().toLowerCase() !== configuredOwnerEmail) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

async function requireOwner(req, _res, next) {
  try {
    ensureOwnerModuleAvailable();

    const configuredSecret = ownerConfiguredSecret();
    const providedSecret = readOwnerSecret(req);
    if (configuredSecret && compareSecrets(providedSecret, configuredSecret)) {
      return next();
    }

    const ownerUser = await readOwnerUserFromToken(req);
    if (ownerUser) {
      req.owner = { user: ownerUser };
      return next();
    }

    throw new AppError(401, 'Owner access denied.');
  } catch (error) {
    next(error);
  }
}

async function buildOwnerSession() {
  const email = ownerEmail();
  if (!email) {
    throw new AppError(503, 'Owner email is not configured.');
  }

  const user = await ensureOwnerAdmin({
    name: ownerName(),
    email,
  });

  return {
    token: issueAccessToken(user),
    user,
    features: await listFeatureFlags(),
  };
}

router.get('/status', requireOwner, async (_req, res) => {
  res.json({
    ownerModuleEnabled: true,
    environment: process.env.NODE_ENV || 'development',
    ownerEmail: ownerEmail() || null,
    emailTransportConfigured: isEmailTransportConfigured(),
    emailConfig: getEmailDeliveryConfigSummary(),
  });
});

router.post('/login', validateRequest({ body: ownerLoginSchema }), async (req, res) => {
  ensureOwnerModuleAvailable();
  const nameMatches = compareSecrets(String(req.body?.name || '').trim().toLowerCase(), ownerLoginName());
  const passwordMatches = compareSecrets(String(req.body?.password || ''), ownerLoginPassword());

  if (!nameMatches || !passwordMatches) {
    throw new AppError(401, 'Invalid owner credentials.');
  }

  const session = await buildOwnerSession();
  res.json({
    message: 'Owner login successful.',
    ...session,
  });
});

router.post('/session', validateRequest({ body: ownerSessionSchema }), requireOwner, async (_req, res) => {
  const session = await buildOwnerSession();
  res.json({
    message: 'Owner session granted.',
    ...session,
  });
});

router.get('/admins/pending', requireOwner, async (_req, res) => {
  const users = await listUsers();
  const pendingAdmins = users.filter((user) => user.role === 'admin' && user.status === 'pending');
  res.json({ pendingAdmins });
});

router.post(
  '/admins/:id/approve',
  validateRequest({ params: idParamSchema, body: ownerPendingActionSchema }),
  requireOwner,
  async (req, res) => {
    const updated = await updateUserByAdmin(req.params.id, { status: 'active' });
    res.json({
      message: 'Admin access approved.',
      user: updated,
    });
  },
);

router.post(
  '/admins/:id/deny',
  validateRequest({ params: idParamSchema, body: ownerPendingActionSchema }),
  requireOwner,
  async (req, res) => {
    const current = await getUserById(req.params.id);
    if (!current) {
      throw new AppError(404, 'User not found.');
    }
    const updated = await updateUserByAdmin(req.params.id, { status: 'disabled' });
    res.json({
      message: 'Admin access denied.',
      user: updated,
    });
  },
);

router.post('/email/test', validateRequest({ body: ownerMailTestSchema }), requireOwner, async (req, res) => {
  const target = req.body.email;
  const delivery = await sendSystemEmail({
    email: target,
    subject: req.body.subject || 'Smart Agriculture mail test',
    title: 'Mail delivery test',
    message:
      req.body.message
      || 'This is an owner-triggered test email from Smart Agriculture. If you received this, SMTP is working.',
    category: 'owner-mail-test',
  });

  res.json({
    message: delivery.delivered ? 'Test email delivered.' : 'Test email delivery failed.',
    delivery,
    routedTo: resolveRecipientForDelivery(target),
    emailConfig: getEmailDeliveryConfigSummary(),
  });
});

export const ownerRouter = router;
