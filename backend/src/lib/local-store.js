import { randomUUID } from 'node:crypto';
import { readDb, updateDb, getFeatureDefaults } from './database.js';
import { AppError } from './errors.js';
import { hashPassword, verifyPassword } from './passwords.js';

const DEFAULT_NOTIFICATION_PREFS = {
  weather: true,
  disease: true,
  lifecycle: true,
  personalized: true,
};

function nowIso() {
  return new Date().toISOString();
}

function normalizePhone(phone) {
  return String(phone || '').replace(/[^\d+]/g, '').trim();
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function defaultProfile(userId, identity = {}) {
  return {
    userId,
    name: identity.name || 'Farmer',
    email: identity.email || '',
    phone: identity.phone || '',
    role: identity.role || 'farmer',
    location: 'Hyderabad',
    latitude: 17.385,
    longitude: 78.4867,
    landSizeAcres: 3,
    crops: ['rice', 'cotton'],
    cropPlans: [
      {
        cropName: 'rice',
        sowingDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        stage: 'vegetative',
      },
    ],
    notificationPreferences: DEFAULT_NOTIFICATION_PREFS,
    updatedAt: nowIso(),
  };
}

function normalizeCropPlans(input, fallback = []) {
  if (!Array.isArray(input)) return fallback;
  return input
    .map((item) => ({
      cropName: String(item.cropName || '').toLowerCase(),
      sowingDate: String(item.sowingDate || ''),
      stage: String(item.stage || 'unknown'),
    }))
    .filter((item) => item.cropName && item.sowingDate)
    .slice(0, 24);
}

function normalizeProfile(userId, source = {}) {
  const safeCrops = Array.isArray(source.crops)
    ? source.crops.map((item) => String(item).toLowerCase()).filter(Boolean).slice(0, 20)
    : [];

  return {
    userId,
    name: String(source.name || 'Farmer').trim() || 'Farmer',
    email: normalizeEmail(source.email),
    phone: String(source.phone || '').trim(),
    role: String(source.role || 'farmer').toLowerCase() === 'admin' ? 'admin' : 'farmer',
    location: String(source.location || 'Hyderabad').trim() || 'Hyderabad',
    latitude: Number.isFinite(Number(source.latitude)) ? Number(source.latitude) : 17.385,
    longitude: Number.isFinite(Number(source.longitude)) ? Number(source.longitude) : 78.4867,
    landSizeAcres: Number.isFinite(Number(source.landSizeAcres)) ? Number(source.landSizeAcres) : 3,
    crops: safeCrops.length ? safeCrops : ['rice'],
    cropPlans: normalizeCropPlans(source.cropPlans, []),
    notificationPreferences: {
      ...DEFAULT_NOTIFICATION_PREFS,
      ...(source.notificationPreferences || {}),
    },
    updatedAt: nowIso(),
  };
}

function sanitizeUser(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    role: row.role,
    name: row.name,
    phone: row.phone || '',
    email: row.email || '',
    status: row.status,
    adminEnabled: row.role === 'admin' && row.status === 'active',
    location: '',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastLoginAt: row.lastLoginAt || null,
  };
}

function readStoredPassword(passwordHash) {
  const [salt = '', hash = ''] = String(passwordHash || '').split(':');
  return { salt, hash };
}

function ensureFeatureMap(db) {
  const defaults = getFeatureDefaults();
  db.featureFlags = {
    ...defaults,
    ...(db.featureFlags && typeof db.featureFlags === 'object' ? db.featureFlags : {}),
  };
  return db.featureFlags;
}

export function getUserByIdLocal(userId) {
  const db = readDb();
  return sanitizeUser(db.users.find((user) => user.id === userId) || null);
}

export function getUserRecordByIdLocal(userId) {
  const db = readDb();
  const row = db.users.find((user) => user.id === userId);
  return row ? structuredClone(row) : null;
}

export function findFarmerByPhoneLocal(phone) {
  const normalizedPhone = normalizePhone(phone);
  const db = readDb();
  const row = db.users.find((user) => user.role === 'farmer' && normalizePhone(user.phone) === normalizedPhone);

  if (!row) {
    throw new AppError(404, 'User not registered');
  }
  if (row.status !== 'active') {
    throw new AppError(403, 'This farmer account is disabled.');
  }

  return sanitizeUser(row);
}

export function createFarmerLocal(payload) {
  const name = String(payload.name || '').trim();
  const phone = normalizePhone(payload.phone);

  if (!name) {
    throw new AppError(400, 'Name is required.');
  }
  if (!phone) {
    throw new AppError(400, 'Phone number is required.');
  }

  let created = null;
  updateDb((db) => {
    const existing = db.users.find((user) => normalizePhone(user.phone) === phone);
    if (existing) {
      throw new AppError(409, 'User already exists, please login');
    }

    const timestamp = nowIso();
    const row = {
      id: randomUUID(),
      role: 'farmer',
      name,
      phone,
      email: null,
      passwordHash: null,
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp,
      lastLoginAt: null,
    };
    db.users.push(row);
    created = sanitizeUser(row);
    return created;
  });

  return created;
}

export function createAdminLocal(payload, status = 'pending') {
  const name = String(payload.name || '').trim();
  const email = normalizeEmail(payload.email);
  const password = String(payload.password || '');

  if (!name) {
    throw new AppError(400, 'Name is required.');
  }
  if (!email) {
    throw new AppError(400, 'Email is required.');
  }
  if (password.length < 8) {
    throw new AppError(400, 'Password must be at least 8 characters long.');
  }

  let created = null;
  updateDb((db) => {
    const existing = db.users.find((user) => normalizeEmail(user.email) === email);
    if (existing) {
      throw new AppError(409, 'Admin email already exists.');
    }

    const { salt, hash } = hashPassword(password);
    const timestamp = nowIso();
    const row = {
      id: randomUUID(),
      role: 'admin',
      name,
      phone: null,
      email,
      passwordHash: `${salt}:${hash}`,
      status,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastLoginAt: null,
    };
    db.users.push(row);
    created = sanitizeUser(row);
    return created;
  });

  return created;
}

export function verifyAdminCredentialsLocal(email, password) {
  const normalizedEmail = normalizeEmail(email);
  const db = readDb();
  const user = db.users.find((entry) => entry.role === 'admin' && normalizeEmail(entry.email) === normalizedEmail);

  if (!user) {
    throw new AppError(404, 'Admin not registered');
  }

  const { salt, hash } = readStoredPassword(user.passwordHash);
  if (!salt || !hash || !verifyPassword(password, salt, hash)) {
    throw new AppError(401, 'Invalid email or password.');
  }
  if (user.status === 'pending') {
    throw new AppError(403, 'Admin signup pending verification. Please complete signup OTP.');
  }
  if (user.status === 'disabled') {
    throw new AppError(403, 'This admin account is disabled.');
  }

  return sanitizeUser(user);
}

export function activateAdminLocal(userId) {
  let updated = null;
  updateDb((db) => {
    const user = db.users.find((entry) => entry.id === userId && entry.role === 'admin');
    if (user) {
      user.status = 'active';
      user.updatedAt = nowIso();
      updated = sanitizeUser(user);
    }
    return updated;
  });
  return updated;
}

export function touchLastLoginLocal(userId) {
  let updated = null;
  updateDb((db) => {
    const user = db.users.find((entry) => entry.id === userId);
    if (user) {
      user.lastLoginAt = nowIso();
      user.updatedAt = nowIso();
      updated = sanitizeUser(user);
    }
    return updated;
  });
  return updated;
}

export function updateAdminProfileLocal(userId, patch) {
  let updated = null;
  updateDb((db) => {
    const user = db.users.find((entry) => entry.id === userId && entry.role === 'admin');
    if (!user) {
      throw new AppError(404, 'Admin not found.');
    }

    const nextName = patch.name ? String(patch.name).trim() : user.name;
    const nextEmail = patch.email ? normalizeEmail(patch.email) : normalizeEmail(user.email);
    let nextPasswordHash = user.passwordHash;

    if (patch.email && nextEmail !== normalizeEmail(user.email)) {
      const existing = db.users.find((entry) => normalizeEmail(entry.email) === nextEmail && entry.id !== userId);
      if (existing) {
        throw new AppError(409, 'Admin email already exists.');
      }
    }

    if (patch.password) {
      if (String(patch.password).length < 8) {
        throw new AppError(400, 'Password must be at least 8 characters long.');
      }
      const { salt, hash } = hashPassword(String(patch.password));
      nextPasswordHash = `${salt}:${hash}`;
    }

    user.name = nextName;
    user.email = nextEmail;
    user.passwordHash = nextPasswordHash;
    user.updatedAt = nowIso();
    updated = sanitizeUser(user);
    return updated;
  });

  return updated;
}

export function listUsersLocal() {
  const db = readDb();
  return db.users
    .slice()
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .map(sanitizeUser);
}

export function updateUserByAdminLocal(userId, patch) {
  let updated = null;
  updateDb((db) => {
    const current = db.users.find((entry) => entry.id === userId);
    if (!current) {
      throw new AppError(404, 'User not found.');
    }

    const nextRole = patch.role ? String(patch.role).toLowerCase() : current.role;
    if (nextRole !== 'admin' && nextRole !== 'farmer') {
      throw new AppError(400, 'Role must be admin or farmer.');
    }

    const nextName = patch.name ? String(patch.name).trim() : current.name;
    if (!nextName) {
      throw new AppError(400, 'Name is required.');
    }

    const nextStatus = patch.status ? String(patch.status).toLowerCase() : current.status;
    if (!['active', 'disabled', 'pending'].includes(nextStatus)) {
      throw new AppError(400, 'Invalid status value.');
    }

    let nextPhone = current.phone;
    let nextEmail = current.email;
    let nextPasswordHash = current.passwordHash;

    if (nextRole === 'farmer') {
      nextPhone = patch.phone ? normalizePhone(patch.phone) : normalizePhone(current.phone);
      if (!nextPhone) {
        throw new AppError(400, 'Phone number is required for farmers.');
      }

      const phoneOwner = db.users.find((entry) => normalizePhone(entry.phone) === nextPhone && entry.id !== userId);
      if (phoneOwner) {
        throw new AppError(409, 'Phone number is already in use.');
      }

      nextEmail = null;
      nextPasswordHash = null;
    } else {
      nextEmail = patch.email ? normalizeEmail(patch.email) : normalizeEmail(current.email);
      if (!nextEmail) {
        throw new AppError(400, 'Email is required for admins.');
      }

      const emailOwner = db.users.find((entry) => normalizeEmail(entry.email) === nextEmail && entry.id !== userId);
      if (emailOwner) {
        throw new AppError(409, 'Admin email already exists.');
      }

      if (patch.password) {
        const nextPassword = String(patch.password);
        if (nextPassword.length < 8) {
          throw new AppError(400, 'Password must be at least 8 characters long.');
        }
        const { salt, hash } = hashPassword(nextPassword);
        nextPasswordHash = `${salt}:${hash}`;
      } else if (!nextPasswordHash) {
        throw new AppError(400, 'Password is required for admin accounts.');
      }

      nextPhone = null;
    }

    current.role = nextRole;
    current.name = nextName;
    current.phone = nextPhone;
    current.email = nextEmail;
    current.passwordHash = nextPasswordHash;
    current.status = nextStatus;
    current.updatedAt = nowIso();
    updated = sanitizeUser(current);
    return updated;
  });

  return updated;
}

export function deleteUserByAdminLocal(userId, actorUserId) {
  let deleted = null;
  updateDb((db) => {
    if (userId === actorUserId) {
      throw new AppError(400, 'You cannot delete your own admin account.');
    }

    const index = db.users.findIndex((entry) => entry.id === userId);
    if (index === -1) {
      throw new AppError(404, 'User not found.');
    }

    const [user] = db.users.splice(index, 1);
    delete db.profiles[userId];
    db.alerts = db.alerts.filter((alert) => alert.userId !== userId);
    db.otpChallenges = db.otpChallenges.filter((challenge) => challenge.userId !== userId);
    deleted = sanitizeUser(user);
    return deleted;
  });

  return deleted;
}

export function getProfileLocal(userId = 'anonymous', identity = {}) {
  let profile = null;
  updateDb((db) => {
    if (!db.profiles[userId]) {
      db.profiles[userId] = defaultProfile(userId, identity);
    }

    profile = normalizeProfile(userId, {
      ...db.profiles[userId],
      email: identity.email || db.profiles[userId].email,
      phone: identity.phone || db.profiles[userId].phone,
      role: identity.role || db.profiles[userId].role,
      name: identity.name || db.profiles[userId].name,
    });

    db.profiles[userId] = profile;
    return profile;
  });

  return profile;
}

export function updateProfileLocal(userId = 'anonymous', patch = {}, identity = {}) {
  let profile = null;
  updateDb((db) => {
    const current = db.profiles[userId] || defaultProfile(userId, identity);
    profile = normalizeProfile(userId, {
      ...current,
      ...patch,
      notificationPreferences: {
        ...current.notificationPreferences,
        ...(patch.notificationPreferences || {}),
      },
      email: identity.email || patch.email || current.email,
      phone: identity.phone || patch.phone || current.phone,
      role: identity.role || patch.role || current.role,
      name: identity.name || patch.name || current.name,
    });
    db.profiles[userId] = profile;
    return profile;
  });

  return profile;
}

export function listProfilesLocal(limit = 1000) {
  const safeLimit = Math.min(Math.max(Number(limit) || 500, 1), 5000);
  const db = readDb();
  return Object.values(db.profiles || {})
    .slice()
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .slice(0, safeLimit);
}

export function listFeatureFlagsLocal() {
  const db = readDb();
  const flags = ensureFeatureMap(db);
  return Object.values(flags)
    .map((row) => ({
      key: row.key,
      title: row.title,
      description: row.description,
      enabled: Boolean(row.enabled),
      updatedAt: row.updatedAt,
    }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

export function updateFeatureFlagsLocal(updates) {
  updateDb((db) => {
    const flags = ensureFeatureMap(db);
    for (const update of updates) {
      if (!flags[update.key]) {
        flags[update.key] = {
          key: update.key,
          title: update.key,
          description: update.key,
          enabled: Boolean(update.enabled),
        };
      }
      flags[update.key] = {
        ...flags[update.key],
        enabled: Boolean(update.enabled),
        updatedAt: nowIso(),
      };
    }
    return flags;
  });

  return listFeatureFlagsLocal();
}

export function addAlertLocal(payload) {
  let alert = null;
  updateDb((db) => {
    const user = db.users.find((entry) => entry.id === payload.userId);
    if (!user) {
      alert = null;
      return null;
    }

    alert = {
      id: randomUUID(),
      userId: payload.userId,
      type: payload.type || 'system',
      level: payload.level || 'medium',
      title: payload.title || 'Notification',
      message: payload.message || 'New notification available.',
      source: payload.source || 'system',
      metadata: payload.metadata || {},
      read: false,
      createdAt: nowIso(),
    };
    db.alerts.unshift(alert);
    db.alerts = db.alerts.slice(0, 500);
    return alert;
  });

  return alert ? structuredClone(alert) : null;
}

export function getAlertsLocal({ source = null, userId = null } = {}) {
  const db = readDb();
  return db.alerts
    .filter((alert) => (!userId || alert.userId === userId) && (!source || alert.source === source))
    .slice()
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 250);
}

export function markAlertReadLocal(id, userId = null) {
  let updated = null;
  updateDb((db) => {
    const alert = db.alerts.find((entry) => entry.id === id && (!userId || entry.userId === userId));
    if (alert) {
      alert.read = true;
      updated = structuredClone(alert);
    }
    return updated;
  });
  return updated;
}

export function deleteAlertLocal(id, userId = null) {
  let deleted = null;
  updateDb((db) => {
    const index = db.alerts.findIndex((entry) => entry.id === id && (!userId || entry.userId === userId));
    if (index !== -1) {
      deleted = structuredClone(db.alerts[index]);
      db.alerts.splice(index, 1);
    }
    return deleted;
  });
  return deleted;
}

export function getAlertsDebugStateLocal(dedupeEntries = []) {
  const alerts = getAlertsLocal({}).slice(0, 20);
  return {
    alertCount: alerts.length,
    dedupeCount: dedupeEntries.length,
    latestAlerts: alerts,
    dedupeEntries,
  };
}

export function appendAuditLogLocal(entry) {
  updateDb((db) => {
    db.auditLog.unshift({
      id: randomUUID(),
      actorUserId: entry.actorUserId,
      targetUserId: entry.targetUserId || null,
      action: entry.action,
      detail: entry.detail,
      payload: entry.payload || null,
      createdAt: nowIso(),
    });
    db.auditLog = db.auditLog.slice(0, 500);
    return db.auditLog[0];
  });
}

export function listAuditLogsLocal(limit = 100) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 500);
  const db = readDb();
  return db.auditLog.slice(0, safeLimit);
}

export function appendEmailLogLocal(entry) {
  let created = null;

  updateDb((db) => {
    created = {
      id: randomUUID(),
      to: String(entry.to || '').trim(),
      subject: String(entry.subject || '').trim(),
      category: String(entry.category || 'system').trim() || 'system',
      transport: String(entry.transport || 'disabled').trim() || 'disabled',
      messageId: entry.messageId || null,
      delivered: Boolean(entry.delivered),
      errorMessage: entry.errorMessage || null,
      payloadPreview: String(entry.payloadPreview || '').trim(),
      createdAt: nowIso(),
    };

    db.emailLog.unshift(created);
    db.emailLog = db.emailLog.slice(0, 500);
    return created;
  });

  return created ? structuredClone(created) : null;
}

export function listEmailLogsLocal(limit = 100) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 500);
  const db = readDb();
  return db.emailLog.slice(0, safeLimit);
}

export function createOtpChallengeLocal(userId, purpose, otp, expiryMinutes, maxAttempts) {
  updateDb((db) => {
    const createdAt = nowIso();
    db.otpChallenges = db.otpChallenges.map((challenge) => {
      if (challenge.userId === userId && challenge.purpose === purpose && !challenge.consumedAt) {
        return {
          ...challenge,
          consumedAt: createdAt,
        };
      }

      return challenge;
    });

    db.otpChallenges.unshift({
      id: randomUUID(),
      userId,
      purpose,
      otpCode: String(otp),
      expiresAt: new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString(),
      attempts: 0,
      maxAttempts,
      consumedAt: null,
      createdAt,
    });
    db.otpChallenges = db.otpChallenges.slice(0, 200);
    return db.otpChallenges[0];
  });
}

export function verifyOtpChallengeLocal(userId, purpose, otp) {
  let verified = false;
  updateDb((db) => {
    const record = db.otpChallenges.find(
      (challenge) => challenge.userId === userId && challenge.purpose === purpose && !challenge.consumedAt,
    );

    if (!record) {
      throw new AppError(404, 'OTP request not found. Please request a new OTP.');
    }
    if (new Date(record.expiresAt).getTime() < Date.now()) {
      throw new AppError(410, 'OTP expired. Please request a new OTP.');
    }
    if (record.attempts >= record.maxAttempts) {
      throw new AppError(429, 'Maximum OTP attempts reached. Please resend OTP.');
    }
    if (String(record.otpCode) !== String(otp || '')) {
      record.attempts += 1;
      throw new AppError(401, 'Invalid OTP.');
    }

    record.consumedAt = nowIso();
    verified = true;
    return true;
  });

  return verified;
}

export function saveChatTurnLocal(payload) {
  let entry = null;
  updateDb((db) => {
    const user = db.users.find((record) => record.id === payload.userId);
    if (!user) {
      throw new AppError(404, 'User not found.');
    }

    entry = {
      id: randomUUID(),
      userId: payload.userId,
      question: String(payload.question || '').trim(),
      answer: String(payload.answer || '').trim(),
      model: String(payload.model || 'rule-engine').trim() || 'rule-engine',
      weatherSummary: payload.weatherSummary || null,
      metadata: payload.metadata || {},
      createdAt: nowIso(),
    };
    db.chatHistory.unshift(entry);
    db.chatHistory = db.chatHistory.slice(0, 500);
    return entry;
  });

  return entry ? structuredClone(entry) : null;
}

export function getChatHistoryLocal(userId, limit = 40) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 200);
  const db = readDb();
  return db.chatHistory
    .filter((entry) => entry.userId === userId)
    .slice()
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, safeLimit);
}
