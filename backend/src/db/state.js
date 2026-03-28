const databaseHealth = {
  ready: false,
  status: 'starting',
  provider: 'unknown',
  detail: null,
  updatedAt: new Date().toISOString(),
};

function serializeDetail(detail) {
  if (!detail) {
    return null;
  }

  if (typeof detail === 'string') {
    return detail;
  }

  if (detail.code && detail.message) {
    return `${detail.code}: ${detail.message}`;
  }

  return detail.message || String(detail);
}

function updateDatabaseHealth(nextState) {
  Object.assign(databaseHealth, nextState, {
    updatedAt: new Date().toISOString(),
  });
}

export function setDatabaseConnecting(provider) {
  updateDatabaseHealth({
    ready: false,
    status: 'connecting',
    provider,
    detail: null,
  });
}

export function setDatabaseReady(provider, detail = null) {
  updateDatabaseHealth({
    ready: true,
    status: 'ready',
    provider,
    detail: serializeDetail(detail),
  });
}

export function setDatabaseUnavailable(provider, detail = null) {
  updateDatabaseHealth({
    ready: false,
    status: 'degraded',
    provider,
    detail: serializeDetail(detail),
  });
}

export function getDatabaseHealth() {
  return { ...databaseHealth };
}
