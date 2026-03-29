import mysql from 'mysql2/promise';
import { AppError } from '../lib/errors.js';
import { observeDbQuery } from '../lib/metrics.js';
import { setDatabaseConnecting, setDatabaseReady, setDatabaseUnavailable } from './state.js';

const DEFAULT_FEATURE_FLAGS = [
  ['weather', 'Weather Intelligence', 'Weather monitoring and irrigation advice'],
  ['cropRecommendation', 'Crop Recommendation', 'Crop recommendation workflows'],
  ['diseaseDetection', 'Disease Detection', 'Disease analysis and treatment suggestions'],
  ['marketPrices', 'Market Intelligence', 'Market insights and price forecasting'],
  ['fertilizerCalculator', 'Fertilizer Calculator', 'Fertilizer planning tools'],
  ['govtSchemes', 'Government Schemes', 'Scheme discovery and eligibility support'],
  ['farmerProfile', 'Farmer Profile', 'Profile and farm preferences'],
  ['profitEstimator', 'Profit Estimator', 'Profit planning calculators'],
  ['notificationsDebug', 'Notifications Debug', 'Operations notifications diagnostics'],
];

let pool = null;
let initPromise = null;
const LOCAL_STORE_DETAIL = 'data/app-db.json';
const CONNECTION_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'EHOSTUNREACH',
  'ETIMEDOUT',
  'ER_ACCESS_DENIED_ERROR',
  'ER_BAD_DB_ERROR',
  'PROTOCOL_CONNECTION_LOST',
  'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR',
  'PROTOCOL_ENQUEUE_AFTER_QUIT',
]);

function normalizeConnectionString(value) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim() || null;
  }

  return trimmed;
}

function hasExplicitMysqlConnectionString() {
  return Boolean(normalizeConnectionString(process.env.MYSQL_URL || process.env.DATABASE_URL));
}

function hasExplicitMysqlConfig() {
  if (hasExplicitMysqlConnectionString()) {
    return true;
  }

  return Boolean(
    normalizeConnectionString(process.env.DB_HOST) ||
      normalizeConnectionString(process.env.DB_PORT) ||
      normalizeConnectionString(process.env.DB_USER) ||
      normalizeConnectionString(process.env.DB_PASSWORD) ||
      normalizeConnectionString(process.env.DB_NAME),
  );
}

export function shouldUseLocalStore() {
  const forceLocalStore = String(process.env.FORCE_LOCAL_STORE || '').trim().toLowerCase();

  if (forceLocalStore === 'true' || forceLocalStore === '1') {
    return true;
  }

  return process.env.NODE_ENV === 'production' && !hasExplicitMysqlConfig();
}

function getConnectionStringConfig(includeDatabase = false) {
  const connectionString = normalizeConnectionString(
    process.env.MYSQL_URL || process.env.DATABASE_URL || process.env.MONGO_URI,
  );

  if (!connectionString) {
    return null;
  }

  let parsed;

  try {
    parsed = new URL(connectionString);
  } catch {
    return null;
  }

  if (!['mysql:', 'mysql2:'].includes(parsed.protocol)) {
    return null;
  }

  const databaseFromUrl = parsed.pathname.replace(/^\//, '');

  return {
    host: parsed.hostname || '127.0.0.1',
    port: Number(parsed.port || 3306),
    user: decodeURIComponent(parsed.username || 'root'),
    password: decodeURIComponent(parsed.password || ''),
    database: includeDatabase ? decodeURIComponent(databaseFromUrl || process.env.DB_NAME || 'smart_agriculture') : undefined,
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: true,
    decimalNumbers: true,
  };
}

function getRootConfig(includeDatabase = false) {
  return getConnectionStringConfig(includeDatabase) || {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: includeDatabase ? process.env.DB_NAME || 'smart_agriculture' : undefined,
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: true,
    decimalNumbers: true,
  };
}

function getDatabaseName() {
  return getConnectionStringConfig(true)?.database || process.env.DB_NAME || 'smart_agriculture';
}

function isDatabaseConnectionError(error) {
  return CONNECTION_ERROR_CODES.has(error?.code);
}

function createDatabaseUnavailableError(error) {
  return new AppError(503, 'Database is unavailable.', error?.message || 'Database connection failed.');
}

function createLocalStoreFallbackError() {
  return new AppError(503, 'Database is unavailable.', 'Local data store mode is active.');
}

async function resetPool() {
  initPromise = null;

  if (!pool) {
    return;
  }

  const currentPool = pool;
  pool = null;

  try {
    await currentPool.end();
  } catch {
    // Ignore cleanup failures while resetting the connection pool.
  }
}

async function seedFeatureFlags() {
  for (const [key, title, description] of DEFAULT_FEATURE_FLAGS) {
    await pool.execute(
      `
        INSERT INTO feature_flags (feature_key, title, description, is_enabled)
        VALUES (?, ?, ?, 1)
        ON DUPLICATE KEY UPDATE
          title = VALUES(title),
          description = VALUES(description)
      `,
      [key, title, description],
    );
  }
}

async function createTables() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id CHAR(36) PRIMARY KEY,
      role VARCHAR(20) NOT NULL,
      name VARCHAR(120) NOT NULL,
      phone VARCHAR(25) NULL UNIQUE,
      email VARCHAR(190) NULL UNIQUE,
      password_hash VARCHAR(255) NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      last_login_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS otp_codes (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id CHAR(36) NOT NULL,
      otp_code VARCHAR(6) NOT NULL,
      purpose VARCHAR(40) NOT NULL,
      expires_at DATETIME NOT NULL,
      attempts INT NOT NULL DEFAULT 0,
      max_attempts INT NOT NULL DEFAULT 3,
      consumed_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_otp_user_purpose (user_id, purpose),
      CONSTRAINT fk_otp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS notifications (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id CHAR(36) NOT NULL,
      title VARCHAR(160) NOT NULL,
      message TEXT NOT NULL,
      type VARCHAR(40) NOT NULL,
      level VARCHAR(20) NOT NULL DEFAULT 'medium',
      source VARCHAR(60) NOT NULL DEFAULT 'system',
      metadata JSON NULL,
      is_read TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_notifications_user (user_id),
      CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS chat_history (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id CHAR(36) NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      model VARCHAR(80) NOT NULL,
      weather_summary JSON NULL,
      metadata JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_chat_history_user_created (user_id, created_at DESC),
      CONSTRAINT fk_chat_history_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS feature_flags (
      feature_key VARCHAR(60) PRIMARY KEY,
      title VARCHAR(120) NOT NULL,
      description VARCHAR(255) NOT NULL,
      is_enabled TINYINT(1) NOT NULL DEFAULT 1,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS farmer_profiles (
      user_id CHAR(36) PRIMARY KEY,
      name VARCHAR(120) NOT NULL DEFAULT 'Farmer',
      email VARCHAR(190) NULL,
      phone VARCHAR(25) NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'farmer',
      location VARCHAR(160) NOT NULL DEFAULT 'Hyderabad',
      latitude DECIMAL(9, 6) NOT NULL DEFAULT 17.385000,
      longitude DECIMAL(9, 6) NOT NULL DEFAULT 78.486700,
      land_size_acres DECIMAL(10, 2) NOT NULL DEFAULT 3.00,
      crops JSON NOT NULL,
      crop_plans JSON NOT NULL,
      notification_preferences JSON NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_profile_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      actor_user_id CHAR(36) NOT NULL,
      target_user_id CHAR(36) NULL,
      action VARCHAR(80) NOT NULL,
      detail TEXT NOT NULL,
      payload JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_audit_actor_created (actor_user_id, created_at DESC),
      INDEX idx_audit_action_created (action, created_at DESC)
    )
  `);
}

async function ensureUsersSchema() {
  const [rows] = await pool.query(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'last_login_at'
    `,
    [getDatabaseName()],
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    await pool.execute('ALTER TABLE users ADD COLUMN last_login_at DATETIME NULL AFTER status');
  }
}

export async function initDatabase() {
  if (initPromise) {
    return initPromise;
  }

  if (shouldUseLocalStore()) {
    setDatabaseReady('local', LOCAL_STORE_DETAIL);
    initPromise = Promise.resolve(null);
    return initPromise;
  }

  setDatabaseConnecting('mysql');
  initPromise = (async () => {
    const databaseName = getDatabaseName();
    const rootConnection = await mysql.createConnection(getRootConfig(false));

    try {
      await rootConnection.query(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    } finally {
      await rootConnection.end().catch(() => {});
    }

    pool = mysql.createPool(getRootConfig(true));
    await createTables();
    await ensureUsersSchema();
    await seedFeatureFlags();
    setDatabaseReady('mysql', databaseName);
    return pool;
  })().catch(async (error) => {
    setDatabaseUnavailable('mysql', error);
    await resetPool();
    throw error;
  });

  return initPromise;
}

export async function query(sql, params = []) {
  const startedAt = process.hrtime.bigint();

  if (shouldUseLocalStore()) {
    observeDbQuery(0, true);
    throw createLocalStoreFallbackError();
  }

  try {
    await initDatabase();
  } catch (error) {
    observeDbQuery(0, false);
    throw createDatabaseUnavailableError(error);
  }

  try {
    const result = await pool.execute(sql, params);
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    observeDbQuery(durationMs, true);
    return result;
  } catch (error) {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    observeDbQuery(durationMs, false);

    if (isDatabaseConnectionError(error)) {
      setDatabaseUnavailable('mysql', error);
      await resetPool();
      throw createDatabaseUnavailableError(error);
    }

    throw error;
  }
}

export async function fetchOne(sql, params = []) {
  const [rows] = await query(sql, params);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

export async function fetchAll(sql, params = []) {
  const [rows] = await query(sql, params);
  return Array.isArray(rows) ? rows : [];
}
