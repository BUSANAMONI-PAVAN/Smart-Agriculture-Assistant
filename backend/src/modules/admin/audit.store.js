import { fetchAll, query } from '../../db/mysql.js';
import { isDatabaseUnavailableError } from '../../lib/errors.js';
import { appendAuditLogLocal, listAuditLogsLocal } from '../../lib/local-store.js';

function mapRow(row) {
  return {
    id: String(row.id),
    actorUserId: row.actor_user_id,
    targetUserId: row.target_user_id || null,
    action: row.action,
    detail: row.detail,
    payload: row.payload && typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload || null,
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

export async function appendAuditLog(entry) {
  return withLocalFallback(
    () => query(
      `
        INSERT INTO audit_logs (actor_user_id, target_user_id, action, detail, payload)
        VALUES (?, ?, ?, ?, ?)
      `,
      [
        entry.actorUserId,
        entry.targetUserId || null,
        entry.action,
        entry.detail,
        entry.payload ? JSON.stringify(entry.payload) : null,
      ],
    ),
    () => appendAuditLogLocal(entry),
  );
}

export async function listAuditLogs(limit = 100) {
  return withLocalFallback(
    async () => {
      const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 500);
      const rows = await fetchAll(
        `
          SELECT *
          FROM audit_logs
          ORDER BY created_at DESC
          LIMIT ${safeLimit}
        `,
      );
      return rows.map(mapRow);
    },
    () => listAuditLogsLocal(limit),
  );
}
