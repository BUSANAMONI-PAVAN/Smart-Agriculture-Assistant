import { Router } from 'express';
import { z } from 'zod';
import { createManagedUser, deleteUserByAdmin, listUsers, updateUserByAdmin } from '../auth/auth.store.js';
import { verifyToken } from '../auth/token.service.js';
import { getAlerts, addAlert, deleteAlert } from '../alerts/alerts.store.js';
import { listFeatureFlags, updateFeatureFlags } from './feature.store.js';
import { sendAccountChangeAlert, sendSystemEmail } from '../notifications/mailer.service.js';
import { AppError } from '../../lib/errors.js';
import { appendAuditLog, listAuditLogs } from './audit.store.js';
import { listEmailLogs } from './email.store.js';
import { validateRequest } from '../../lib/validate.js';

const router = Router();

const idParamSchema = z.object({
  id: z.string().trim().min(3).max(64),
});

const createUserSchema = z.object({
  otpProofToken: z.string().trim().min(16),
  role: z.enum(['farmer', 'admin']),
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(25).optional(),
  email: z.string().trim().email().optional(),
  password: z.string().min(8).max(120).optional(),
}).strict();

const updateUserSchema = z.object({
  otpProofToken: z.string().trim().min(16),
  role: z.enum(['farmer', 'admin']).optional(),
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().min(7).max(25).optional(),
  email: z.string().trim().email().optional(),
  password: z.string().min(8).max(120).optional(),
  status: z.enum(['active', 'disabled', 'pending']).optional(),
}).strict();

const deleteNotificationSchema = z.object({
  otpProofToken: z.string().trim().min(16),
}).strict();

const updateFeaturesSchema = z.object({
  otpProofToken: z.string().trim().min(16),
  features: z.array(z.object({
    key: z.string().trim().min(2).max(60),
    enabled: z.boolean(),
  })).max(120),
}).strict();

function isOwnerUser(user) {
  const configuredOwnerEmail = String(process.env.OWNER_EMAIL || '').trim().toLowerCase();
  if (!configuredOwnerEmail) {
    return false;
  }
  return String(user?.email || '').trim().toLowerCase() === configuredOwnerEmail;
}

function formatRemovalTime(now = new Date()) {
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

function buildAccountActionMessage({ action, targetUser, actorUser, actionTime, extra = '' }) {
  const actorName = String(actorUser?.name || 'System administrator').trim() || 'System administrator';
  const actorEmail = String(actorUser?.email || '').trim() || 'Not available';
  const targetName = String(targetUser?.name || 'Unknown user').trim() || 'Unknown user';
  const targetRole = String(targetUser?.role || 'unknown').trim() || 'unknown';
  const targetEmail = String(targetUser?.email || '').trim() || 'Not available';
  const targetPhone = String(targetUser?.phone || '').trim() || 'Not available';

  const lines = [
    `Your Smart Agriculture account was ${action}.`,
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

function readSystemControlProof(req) {
  if (isOwnerUser(req.auth?.user)) {
    return;
  }

  const token = req.body?.otpProofToken || req.headers['x-otp-proof'];
  if (!token || typeof token !== 'string') {
    throw new AppError(403, 'OTP verification is required for system control.');
  }

  const payload = verifyToken(token);
  if (payload.type !== 'action_proof' || payload.purpose !== 'system_control') {
    throw new AppError(403, 'OTP proof is invalid or expired.');
  }

  if (payload.sub !== req.auth.user.id) {
    throw new AppError(403, 'OTP proof does not belong to the signed-in admin.');
  }
}

router.get('/stats', async (_req, res) => {
  const users = await listUsers();
  const alerts = await getAlerts({});
  res.json({
    totalUsers: users.length,
    admins: users.filter((user) => user.role === 'admin').length,
    farmers: users.filter((user) => user.role === 'farmer').length,
    notifications: alerts.length,
  });
});

router.get('/console', async (req, res) => {
  const users = await listUsers();
  const alerts = await getAlerts({});
  const features = await listFeatureFlags();
  const auditLog = await listAuditLogs(100);
  const emailLog = await listEmailLogs(100);

  res.json({
    stats: {
      totalUsers: users.length,
      admins: users.filter((user) => user.role === 'admin').length,
      farmers: users.filter((user) => user.role === 'farmer').length,
      disabledUsers: users.filter((user) => user.status !== 'active').length,
      adminAccessDisabled: 0,
      totalAlerts: alerts.length,
      enabledFeatures: features.filter((feature) => feature.enabled).length,
    },
    users,
    features,
    alerts: alerts.slice(0, 20),
    auditLog,
    emailLog,
    currentUser: req.auth.user,
  });
});

router.get('/users', async (_req, res) => {
  const users = await listUsers();
  res.json({ users });
});

router.post('/users', validateRequest({ body: createUserSchema }), async (req, res) => {
  readSystemControlProof(req);
  const user = await createManagedUser(req.body || {});
  const actionTime = formatRemovalTime(new Date());
  await appendAuditLog({
    actorUserId: req.auth.user.id,
    targetUserId: user.id,
    action: 'admin.user.create',
    detail: `Created ${user.role} user "${user.name}".`,
    payload: {
      role: user.role,
      email: user.email || null,
      phone: user.phone || null,
    },
  });
  await addAlert({
    userId: req.auth.user.id,
    type: 'system',
    level: 'medium',
    title: 'User created',
    message: `${user.role} account created for ${user.name}.`,
    source: 'admin-user-create',
    metadata: {
      targetUserId: user.id,
      targetRole: user.role,
    },
  });

  if (user.email) {
    const message = buildAccountActionMessage({
      action: 'created',
      targetUser: user,
      actorUser: req.auth.user,
      actionTime,
      extra: 'You can now log in and use Smart Agriculture.',
    });
    await sendSystemEmail({
      email: user.email,
      subject: `Smart Agriculture account created: ${user.name}`,
      title: 'Account created notification',
      message,
      category: 'admin-user-create',
    });
  }

  res.status(201).json({ message: 'User created successfully.', user });
});

router.patch('/users/:id', validateRequest({ params: idParamSchema, body: updateUserSchema }), async (req, res) => {
  readSystemControlProof(req);
  const user = await updateUserByAdmin(req.params.id, req.body || {});
  const actionTime = formatRemovalTime(new Date());
  await appendAuditLog({
    actorUserId: req.auth.user.id,
    targetUserId: user.id,
    action: 'admin.user.update',
    detail: `Updated user "${user.name}" (${user.role}).`,
    payload: req.body || {},
  });

  await addAlert({
    userId: req.auth.user.id,
    type: 'system',
    level: 'medium',
    title: 'User updated',
    message: `Account for ${user.name} was updated.`,
    source: 'admin-user-update',
    metadata: {
      targetUserId: user.id,
    },
  });

  if (user.email) {
    const patchSummary = Object.entries(req.body || {})
      .filter(([key]) => key !== 'otpProofToken' && key !== 'password')
      .map(([key, value]) => `${key}=${String(value)}`)
      .join(', ');
    const message = buildAccountActionMessage({
      action: 'updated',
      targetUser: user,
      actorUser: req.auth.user,
      actionTime,
      extra: patchSummary ? `Updated fields: ${patchSummary}` : 'Your account details were updated.',
    });
    await sendSystemEmail({
      email: user.email,
      subject: `Smart Agriculture account updated: ${user.name}`,
      title: 'Account updated notification',
      message,
      category: 'admin-user-update',
    });
  }

  res.json({ message: 'User updated successfully.', user });
});

router.delete('/users/:id', validateRequest({ params: idParamSchema, body: deleteNotificationSchema }), async (req, res) => {
  readSystemControlProof(req);
  const user = await deleteUserByAdmin(req.params.id, req.auth.user.id);
  const removedAt = formatRemovalTime(new Date());
  await appendAuditLog({
    actorUserId: req.auth.user.id,
    targetUserId: user.id,
    action: 'admin.user.delete',
    detail: `Deleted user "${user.name}" (${user.role}) at ${removedAt.iso}.`,
    payload: {
      role: user.role,
      email: user.email || null,
      phone: user.phone || null,
      removedByName: req.auth.user.name || null,
      removedByEmail: req.auth.user.email || null,
      removedAt: removedAt.iso,
    },
  });
  await addAlert({
    userId: req.auth.user.id,
    type: 'system',
    level: 'high',
    title: 'User removed',
    message: `${user.name} (${user.role}) was removed from the system.`,
    source: 'admin-user-delete',
    metadata: {
      targetUserId: user.id,
    },
  });

  if (user.email) {
    const removalMessage = buildAccountActionMessage({
      action: 'removed',
      targetUser: user,
      actorUser: req.auth.user,
      actionTime: removedAt,
      extra: '',
    });
    await sendSystemEmail({
      email: user.email,
      subject: `Smart Agriculture account removed: ${user.name}`,
      title: 'Account removed notification',
      message: removalMessage,
      category: 'admin-user-delete',
    });
  }

  res.json({ message: 'User deleted successfully.', user });
});

router.delete('/notifications/:id', validateRequest({ params: idParamSchema, body: deleteNotificationSchema }), async (req, res) => {
  readSystemControlProof(req);
  const deleted = await deleteAlert(req.params.id, null);
  if (!deleted) {
    throw new AppError(404, 'Notification not found.');
  }
  await appendAuditLog({
    actorUserId: req.auth.user.id,
    targetUserId: deleted.userId || null,
    action: 'admin.notification.delete',
    detail: `Deleted notification ${deleted.id}.`,
    payload: {
      notificationId: deleted.id,
      type: deleted.type,
      level: deleted.level,
      source: deleted.source,
    },
  });

  await addAlert({
    userId: req.auth.user.id,
    type: 'system',
    level: 'low',
    title: 'Notification deleted',
    message: 'A notification was deleted from the admin panel.',
    source: 'admin-notification-delete',
    metadata: {
      deletedNotificationId: deleted.id,
    },
  });

  res.json({ message: 'Notification deleted successfully.', notification: deleted });
});

router.put('/features', validateRequest({ body: updateFeaturesSchema }), async (req, res) => {
  readSystemControlProof(req);
  const updates = Array.isArray(req.body?.features) ? req.body.features : [];
  const features = await updateFeatureFlags(updates);
  await appendAuditLog({
    actorUserId: req.auth.user.id,
    targetUserId: null,
    action: 'admin.features.update',
    detail: `Updated ${updates.length} feature flags.`,
    payload: updates,
  });

  await addAlert({
    userId: req.auth.user.id,
    type: 'system',
    level: 'high',
    title: 'System features updated',
    message: 'Platform feature flags were updated successfully.',
    source: 'admin-system-control',
    metadata: {},
  });

  if (req.auth.user.email) {
    await sendAccountChangeAlert(req.auth.user.email, 'performed a system control update');
  }

  res.json({ message: 'Feature flags updated successfully.', features });
});

export const adminRouter = router;
