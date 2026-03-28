import { fetchAll, query } from '../../db/mysql.js';
import { isDatabaseUnavailableError } from '../../lib/errors.js';
import { listFeatureFlagsLocal, updateFeatureFlagsLocal } from '../../lib/local-store.js';

function mapRow(row) {
  return {
    key: row.feature_key,
    title: row.title,
    description: row.description,
    enabled: Boolean(row.is_enabled),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
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

export async function listFeatureFlags() {
  return withLocalFallback(
    async () => {
      const rows = await fetchAll(
        `
          SELECT *
          FROM feature_flags
          ORDER BY feature_key ASC
        `,
      );
      return rows.map(mapRow);
    },
    () => listFeatureFlagsLocal(),
  );
}

export async function updateFeatureFlags(updates) {
  return withLocalFallback(
    async () => {
      for (const update of updates) {
        await query(
          `
            UPDATE feature_flags
            SET is_enabled = ?
            WHERE feature_key = ?
          `,
          [update.enabled ? 1 : 0, update.key],
        );
      }

      return listFeatureFlags();
    },
    () => updateFeatureFlagsLocal(updates),
  );
}
