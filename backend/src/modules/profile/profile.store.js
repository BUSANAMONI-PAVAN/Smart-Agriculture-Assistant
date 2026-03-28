import { fetchAll, fetchOne, query } from '../../db/mysql.js';

const DEFAULT_NOTIFICATION_PREFS = {
  weather: true,
  disease: true,
  lifecycle: true,
  personalized: true,
};

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
    updatedAt: new Date().toISOString(),
  };
}

function parseJson(input, fallback) {
  if (!input) return fallback;
  if (typeof input === 'object') return input;
  try {
    return JSON.parse(String(input));
  } catch {
    return fallback;
  }
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
    email: String(source.email || '').trim().toLowerCase(),
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
  };
}

function mapRow(row) {
  if (!row) return null;
  return {
    userId: row.user_id,
    name: row.name,
    email: row.email || '',
    phone: row.phone || '',
    role: row.role || 'farmer',
    location: row.location,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    landSizeAcres: Number(row.land_size_acres),
    crops: parseJson(row.crops, ['rice']),
    cropPlans: normalizeCropPlans(parseJson(row.crop_plans, []), []),
    notificationPreferences: {
      ...DEFAULT_NOTIFICATION_PREFS,
      ...(parseJson(row.notification_preferences, {}) || {}),
    },
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

async function ensureProfile(userId, identity = {}) {
  const defaults = defaultProfile(userId, identity);
  await query(
    `
      INSERT INTO farmer_profiles (
        user_id, name, email, phone, role, location, latitude, longitude, land_size_acres,
        crops, crop_plans, notification_preferences
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name = IF(name IS NULL OR name = '', VALUES(name), name),
        email = IF(email IS NULL, VALUES(email), email),
        phone = IF(phone IS NULL, VALUES(phone), phone),
        role = IF(role IS NULL OR role = '', VALUES(role), role)
    `,
    [
      userId,
      defaults.name,
      defaults.email || null,
      defaults.phone || null,
      defaults.role,
      defaults.location,
      defaults.latitude,
      defaults.longitude,
      defaults.landSizeAcres,
      JSON.stringify(defaults.crops),
      JSON.stringify(defaults.cropPlans),
      JSON.stringify(defaults.notificationPreferences),
    ],
  );
}

export async function getProfile(userId = 'anonymous', identity = {}) {
  await ensureProfile(userId, identity);
  const row = await fetchOne('SELECT * FROM farmer_profiles WHERE user_id = ?', [userId]);
  const profile = mapRow(row);
  return {
    ...profile,
    email: identity.email || profile.email,
    phone: identity.phone || profile.phone,
    role: identity.role || profile.role,
    name: identity.name || profile.name,
  };
}

export async function updateProfile(userId = 'anonymous', patch = {}, identity = {}) {
  const current = await getProfile(userId, identity);
  const merged = normalizeProfile(userId, {
    ...current,
    ...patch,
    notificationPreferences: {
      ...current.notificationPreferences,
      ...(patch.notificationPreferences || {}),
    },
  });

  await query(
    `
      UPDATE farmer_profiles
      SET
        name = ?,
        email = ?,
        phone = ?,
        role = ?,
        location = ?,
        latitude = ?,
        longitude = ?,
        land_size_acres = ?,
        crops = ?,
        crop_plans = ?,
        notification_preferences = ?
      WHERE user_id = ?
    `,
    [
      merged.name,
      merged.email || null,
      merged.phone || null,
      merged.role,
      merged.location,
      merged.latitude,
      merged.longitude,
      merged.landSizeAcres,
      JSON.stringify(merged.crops),
      JSON.stringify(merged.cropPlans),
      JSON.stringify(merged.notificationPreferences),
      userId,
    ],
  );

  return getProfile(userId, identity);
}

export async function listProfiles(limit = 1000) {
  const safeLimit = Math.min(Math.max(Number(limit) || 500, 1), 5000);
  const rows = await fetchAll(
    `
      SELECT *
      FROM farmer_profiles
      ORDER BY updated_at DESC
      LIMIT ${safeLimit}
    `,
  );
  return rows.map(mapRow);
}

