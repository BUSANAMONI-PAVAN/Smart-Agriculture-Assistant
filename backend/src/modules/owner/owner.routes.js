import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import {
  createManagedUser,
  deleteUserByAdmin,
  ensureOwnerAdmin,
  getUserById,
  listUsers,
  updateUserByAdmin,
} from '../auth/auth.store.js';
import { issueAccessToken, verifyToken } from '../auth/token.service.js';
import { listFeatureFlags } from '../admin/feature.store.js';
import { addAlert } from '../alerts/alerts.store.js';
import { appendAuditLog } from '../admin/audit.store.js';
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

const ownerCreateUserSchema = z.object({
  role: z.enum(['farmer', 'admin']),
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(25).optional(),
  email: z.string().trim().email().optional(),
  password: z.string().min(8).max(120).optional(),
}).strict();

const ownerUpdateUserSchema = z.object({
  role: z.enum(['farmer', 'admin']).optional(),
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().min(7).max(25).optional(),
  email: z.string().trim().email().optional(),
  password: z.string().min(8).max(120).optional(),
  status: z.enum(['active', 'disabled', 'pending']).optional(),
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

function ownerActorFromRequest(req) {
  const ownerUser = req.owner?.user || null;
  return {
    id: ownerUser?.id || null,
    name: String(ownerUser?.name || ownerName() || 'Owner').trim(),
    email: String(ownerUser?.email || ownerEmail() || '').trim(),
  };
}

function formatActionTime(now = new Date()) {
  const local = new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'full',
    timeStyle: 'medium',
    timeZone: 'Asia/Kolkata',
  }).format(now);

  return {
    local,
    iso: now.toISOString(),
  };
}

function buildAccountActionMessage({ action, targetUser, actor, actionTime, extra = '' }) {
  const targetName = String(targetUser?.name || 'Unknown user').trim() || 'Unknown user';
  const targetRole = String(targetUser?.role || 'unknown').trim() || 'unknown';
  const targetEmail = String(targetUser?.email || '').trim() || 'Not available';
  const targetPhone = String(targetUser?.phone || '').trim() || 'Not available';
  const actorName = String(actor?.name || 'Owner').trim() || 'Owner';
  const actorEmail = String(actor?.email || '').trim() || 'Not available';

  const lines = [
    `Your Smart Agriculture account was ${action} by the owner.`,
    `Account name: ${targetName}`,
    `Account role: ${targetRole}`,
    `Account email: ${targetEmail}`,
    `Account phone: ${targetPhone}`,
    `Action by: ${actorName} (${actorEmail})`,
    `Action time (India): ${actionTime.local}`,
    `Action time (UTC): ${actionTime.iso}`,
  ];

  if (extra) {
    lines.push(extra);
  }
  lines.push('If this is unexpected, contact Smart Agriculture support.');
  return lines.join(' ');
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

router.get('/users', requireOwner, async (_req, res) => {
  const users = await listUsers();
  res.json({ users });
});

router.post('/users', validateRequest({ body: ownerCreateUserSchema }), requireOwner, async (req, res) => {
  const actor = ownerActorFromRequest(req);
  const user = await createManagedUser(req.body || {});
  const actionTime = formatActionTime(new Date());

  if (actor.id) {
    await appendAuditLog({
      actorUserId: actor.id,
      targetUserId: user.id,
      action: 'owner.user.create',
      detail: `Owner created ${user.role} user "${user.name}".`,
      payload: {
        role: user.role,
        email: user.email || null,
        phone: user.phone || null,
      },
    });

    await addAlert({
      userId: actor.id,
      type: 'system',
      level: 'high',
      title: 'Owner created user',
      message: `${user.role} account created for ${user.name}.`,
      source: 'owner-user-create',
      metadata: {
        targetUserId: user.id,
      },
    });
  }

  if (user.email) {
    await sendSystemEmail({
      email: user.email,
      subject: `Smart Agriculture account created: ${user.name}`,
      title: 'Account created by owner',
      message: buildAccountActionMessage({
        action: 'created',
        targetUser: user,
        actor,
        actionTime,
        extra: 'You can now use Smart Agriculture with this account.',
      }),
      category: 'owner-user-create',
    });
  }

  res.status(201).json({ message: 'User created by owner.', user });
});

router.patch('/users/:id', validateRequest({ params: idParamSchema, body: ownerUpdateUserSchema }), requireOwner, async (req, res) => {
  const actor = ownerActorFromRequest(req);
  const updated = await updateUserByAdmin(req.params.id, req.body || {});
  const actionTime = formatActionTime(new Date());

  if (actor.id) {
    await appendAuditLog({
      actorUserId: actor.id,
      targetUserId: updated.id,
      action: 'owner.user.update',
      detail: `Owner updated user "${updated.name}" (${updated.role}).`,
      payload: req.body || {},
    });

    await addAlert({
      userId: actor.id,
      type: 'system',
      level: 'high',
      title: 'Owner updated user',
      message: `${updated.name} account details were updated by owner.`,
      source: 'owner-user-update',
      metadata: {
        targetUserId: updated.id,
      },
    });
  }

  if (updated.email) {
    const patchSummary = Object.entries(req.body || {})
      .map(([key, value]) => `${key}=${String(value)}`)
      .join(', ');

    await sendSystemEmail({
      email: updated.email,
      subject: `Smart Agriculture account updated: ${updated.name}`,
      title: 'Account updated by owner',
      message: buildAccountActionMessage({
        action: 'updated',
        targetUser: updated,
        actor,
        actionTime,
        extra: patchSummary ? `Updated fields: ${patchSummary}` : 'Your account details were updated by owner.',
      }),
      category: 'owner-user-update',
    });
  }

  res.json({ message: 'User updated by owner.', user: updated });
});

router.delete('/users/:id', validateRequest({ params: idParamSchema }), requireOwner, async (req, res) => {
  const actor = ownerActorFromRequest(req);
  const removedAt = formatActionTime(new Date());
  const user = await deleteUserByAdmin(req.params.id, actor.id || '__owner__');

  if (actor.id) {
    await appendAuditLog({
      actorUserId: actor.id,
      targetUserId: user.id,
      action: 'owner.user.delete',
      detail: `Owner removed user "${user.name}" (${user.role}) at ${removedAt.iso}.`,
      payload: {
        role: user.role,
        email: user.email || null,
        phone: user.phone || null,
        removedByName: actor.name,
        removedByEmail: actor.email || null,
        removedAt: removedAt.iso,
      },
    });

    await addAlert({
      userId: actor.id,
      type: 'system',
      level: 'high',
      title: 'Owner removed user',
      message: `${user.name} (${user.role}) was removed by owner.`,
      source: 'owner-user-delete',
      metadata: {
        targetUserId: user.id,
      },
    });
  }

  if (user.email) {
    await sendSystemEmail({
      email: user.email,
      subject: `Smart Agriculture account removed: ${user.name}`,
      title: 'Account removed by owner',
      message: buildAccountActionMessage({
        action: 'removed',
        targetUser: user,
        actor,
        actionTime: removedAt,
      }),
      category: 'owner-user-delete',
    });
  }

  res.json({ message: 'User removed by owner.', user });
});

router.post(
  '/admins/:id/approve',
  validateRequest({ params: idParamSchema, body: ownerPendingActionSchema }),
  requireOwner,
  async (req, res) => {
    const actor = ownerActorFromRequest(req);
    const updated = await updateUserByAdmin(req.params.id, { status: 'active' });

    if (updated.email) {
      await sendSystemEmail({
        email: updated.email,
        subject: 'Smart Agriculture admin access approved',
        title: 'Admin access approved',
        message: buildAccountActionMessage({
          action: 'approved',
          targetUser: updated,
          actor,
          actionTime: formatActionTime(new Date()),
          extra: 'Your admin signup request is approved. You can log in now.',
        }),
        category: 'owner-admin-approve',
      });
    }

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
    const actor = ownerActorFromRequest(req);
    const current = await getUserById(req.params.id);
    if (!current) {
      throw new AppError(404, 'User not found.');
    }
    const updated = await updateUserByAdmin(req.params.id, { status: 'disabled' });

    if (updated.email) {
      await sendSystemEmail({
        email: updated.email,
        subject: 'Smart Agriculture admin access denied',
        title: 'Admin access denied',
        message: buildAccountActionMessage({
          action: 'denied',
          targetUser: updated,
          actor,
          actionTime: formatActionTime(new Date()),
          extra: 'Your admin signup request was denied. Contact owner for details.',
        }),
        category: 'owner-admin-deny',
      });
    }

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
