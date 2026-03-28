import { fetchAll, query } from '../../db/mysql.js';

function mapRow(row) {
  return {
    key: row.feature_key,
    title: row.title,
    description: row.description,
    enabled: Boolean(row.is_enabled),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
  };
}

export async function listFeatureFlags() {
  const rows = await fetchAll(
    `
      SELECT *
      FROM feature_flags
      ORDER BY feature_key ASC
    `,
  );
  return rows.map(mapRow);
}

export async function updateFeatureFlags(updates) {
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
}
