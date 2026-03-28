import { EventEmitter } from 'node:events';
import { fetchAll, fetchOne, query } from '../../db/mysql.js';
import { isDatabaseUnavailableError } from '../../lib/errors.js';
import {
  addAlertLocal,
  deleteAlertLocal,
  getAlertsDebugStateLocal,
  getAlertsLocal,
  markAlertReadLocal,
} from '../../lib/local-store.js';
import { emitUserNotification } from '../../realtime/socket.js';

const alertEvents = new EventEmitter();
const dedupeMap = new Map();

alertEvents.setMaxListeners(0);

function cooldownMsByLevel(level) {
  if (level === 'high') return 3 * 60 * 60 * 1000;
  if (level === 'medium') return 8 * 60 * 60 * 1000;
  return 18 * 60 * 60 * 1000;
}

function fingerprintFor(alert) {
  const explicit = alert?.metadata?.fingerprint;
  if (typeof explicit === 'string' && explicit.trim()) {
    return `${alert.userId}|${explicit}`;
  }
  const dateBucket = new Date().toISOString().slice(0, 10);
  return `${alert.userId}|${alert.type}|${alert.title}|${alert.source || 'system'}|${dateBucket}`;
}

function mapNotificationRow(row) {
  return {
    id: String(row.id),
    userId: row.user_id,
    type: row.type,
    level: row.level,
    title: row.title,
    message: row.message,
    source: row.source,
    metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata || {},
    read: Boolean(row.is_read),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

async function withLocalFallback(action, fallback) {
  try {
    return await action();
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return fallback();
    }
    throw error;
  }
}

export function shouldStoreAlert(alert) {
  const key = fingerprintFor(alert);
  const last = dedupeMap.get(key);
  const now = Date.now();
  if (last && now - last < cooldownMsByLevel(alert.level)) {
    return false;
  }
  dedupeMap.set(key, now);
  return true;
}

export async function addAlert(payload) {
  const notify = (alert) => {
    if (!alert) {
      return null;
    }
    alertEvents.emit('alert', alert);
    emitUserNotification(alert.userId, alert);
    return alert;
  };

  return withLocalFallback(
    async () => {
      const user = await fetchOne('SELECT id FROM users WHERE id = ?', [payload.userId]);
      if (!user) {
        return null;
      }

      const metadata = payload.metadata ? JSON.stringify(payload.metadata) : null;
      const [result] = await query(
        `
          INSERT INTO notifications (user_id, title, message, type, level, source, metadata)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          payload.userId,
          payload.title || 'Notification',
          payload.message || 'New notification available.',
          payload.type || 'system',
          payload.level || 'medium',
          payload.source || 'system',
          metadata,
        ],
      );

      const row = await fetchOne('SELECT * FROM notifications WHERE id = ?', [result.insertId]);
      return notify(mapNotificationRow(row));
    },
    () => notify(addAlertLocal(payload)),
  );
}

export async function getAlerts({ source = null, userId = null } = {}) {
  return withLocalFallback(
    async () => {
      const clauses = [];
      const params = [];

      if (userId) {
        clauses.push('user_id = ?');
        params.push(userId);
      }
      if (source) {
        clauses.push('source = ?');
        params.push(source);
      }

      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      const rows = await fetchAll(
        `
          SELECT *
          FROM notifications
          ${where}
          ORDER BY created_at DESC
          LIMIT 250
        `,
        params,
      );

      return rows.map(mapNotificationRow);
    },
    () => getAlertsLocal({ source, userId }),
  );
}

export async function markAlertRead(id, userId = null) {
  return withLocalFallback(
    async () => {
      if (userId) {
        await query('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [id, userId]);
      } else {
        await query('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
      }
      const row = await fetchOne('SELECT * FROM notifications WHERE id = ?', [id]);
      return row ? mapNotificationRow(row) : null;
    },
    () => markAlertReadLocal(id, userId),
  );
}

export async function deleteAlert(id, userId = null) {
  return withLocalFallback(
    async () => {
      const row = await fetchOne('SELECT * FROM notifications WHERE id = ?', [id]);
      if (!row) {
        return null;
      }

      if (userId && row.user_id !== userId) {
        return null;
      }

      await query('DELETE FROM notifications WHERE id = ?', [id]);
      return mapNotificationRow(row);
    },
    () => deleteAlertLocal(id, userId),
  );
}

export function subscribeToAlerts(listener) {
  alertEvents.on('alert', listener);
  return () => alertEvents.off('alert', listener);
}

export async function getAlertsDebugState() {
  const now = Date.now();
  const dedupeEntries = Array.from(dedupeMap.entries()).slice(0, 120).map(([fingerprint, lastAt]) => {
    const parts = fingerprint.split('|');
    const type = parts[1] || 'system';
    const source = parts[3] || 'system';
    const level = type === 'weather' ? 'high' : type === 'disease' ? 'medium' : 'low';
    const cooldownMs = cooldownMsByLevel(level);
    const nextEligibleAt = new Date(lastAt + cooldownMs).toISOString();
    const remainingMs = Math.max(0, lastAt + cooldownMs - now);

    return {
      fingerprint,
      type,
      source,
      lastAt: new Date(lastAt).toISOString(),
      nextEligibleAt,
      remainingMinutes: Math.ceil(remainingMs / 60000),
    };
  });

  return withLocalFallback(
    async () => {
      const rows = await fetchAll(
        `
          SELECT *
          FROM notifications
          ORDER BY created_at DESC
          LIMIT 20
        `,
      );

      return {
        alertCount: rows.length,
        dedupeCount: dedupeMap.size,
        latestAlerts: rows.map(mapNotificationRow),
        dedupeEntries,
      };
    },
    () => getAlertsDebugStateLocal(dedupeEntries),
  );
}
