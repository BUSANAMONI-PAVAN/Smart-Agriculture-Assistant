import { fetchAll, query } from '../../db/mysql.js';
import { isDatabaseUnavailableError } from '../../lib/errors.js';
import { appendEmailLogLocal, listEmailLogsLocal } from '../../lib/local-store.js';

function mapRow(row) {
  return {
    id: String(row.id),
    to: row.to_email,
    subject: row.subject,
    category: row.category,
    transport: row.transport,
    messageId: row.message_id || null,
    delivered: Boolean(row.delivered),
    errorMessage: row.error_message || null,
    payloadPreview: row.payload_preview || '',
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

export async function appendEmailLog(entry) {
  return withLocalFallback(
    async () => {
      const [result] = await query(
        `
          INSERT INTO email_logs (
            to_email, subject, category, transport, message_id, delivered, error_message, payload_preview
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          entry.to,
          entry.subject,
          entry.category || 'system',
          entry.transport || 'disabled',
          entry.messageId || null,
          entry.delivered ? 1 : 0,
          entry.errorMessage || null,
          entry.payloadPreview || '',
        ],
      );

      return {
        id: String(result?.insertId || ''),
        to: entry.to,
        subject: entry.subject,
        category: entry.category || 'system',
        transport: entry.transport || 'disabled',
        messageId: entry.messageId || null,
        delivered: Boolean(entry.delivered),
        errorMessage: entry.errorMessage || null,
        payloadPreview: entry.payloadPreview || '',
        createdAt: new Date().toISOString(),
      };
    },
    () => appendEmailLogLocal(entry),
  );
}

export async function listEmailLogs(limit = 100) {
  return withLocalFallback(
    async () => {
      const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 500);
      const rows = await fetchAll(
        `
          SELECT *
          FROM email_logs
          ORDER BY created_at DESC
          LIMIT ${safeLimit}
        `,
      );
      return rows.map(mapRow);
    },
    () => listEmailLogsLocal(limit),
  );
}
