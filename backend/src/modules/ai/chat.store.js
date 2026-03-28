import { fetchAll, fetchOne, query } from '../../db/mysql.js';
import { isDatabaseUnavailableError } from '../../lib/errors.js';
import { getChatHistoryLocal, saveChatTurnLocal } from '../../lib/local-store.js';

function parseJson(input, fallback = null) {
  if (!input) return fallback;
  if (typeof input === 'object') return input;
  try {
    return JSON.parse(String(input));
  } catch {
    return fallback;
  }
}

function mapRow(row) {
  return {
    id: String(row.id),
    userId: row.user_id,
    question: row.question,
    answer: row.answer,
    model: row.model,
    weatherSummary: parseJson(row.weather_summary, null),
    metadata: parseJson(row.metadata, {}),
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

export async function saveChatTurn(payload) {
  return withLocalFallback(
    async () => {
      const [result] = await query(
        `
          INSERT INTO chat_history (user_id, question, answer, model, weather_summary, metadata)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          payload.userId,
          payload.question,
          payload.answer,
          payload.model || 'rule-engine',
          payload.weatherSummary ? JSON.stringify(payload.weatherSummary) : null,
          payload.metadata ? JSON.stringify(payload.metadata) : null,
        ],
      );

      const row = await fetchOne('SELECT * FROM chat_history WHERE id = ?', [result.insertId]);
      return row ? mapRow(row) : null;
    },
    () => saveChatTurnLocal(payload),
  );
}

export async function getChatHistory(userId, limit = 40) {
  return withLocalFallback(
    async () => {
      const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 200);
      const rows = await fetchAll(
        `
          SELECT *
          FROM chat_history
          WHERE user_id = ?
          ORDER BY created_at DESC
          LIMIT ${safeLimit}
        `,
        [userId],
      );

      return rows.map(mapRow);
    },
    () => getChatHistoryLocal(userId, limit),
  );
}
