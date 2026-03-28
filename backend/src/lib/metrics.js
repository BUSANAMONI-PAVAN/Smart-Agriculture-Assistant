const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

const state = {
  startedAt: new Date().toISOString(),
  totals: {
    requests: 0,
    errors: 0,
  },
  db: {
    queries: 0,
    errors: 0,
    avgMs: 0,
    maxMs: 0,
  },
  routes: {},
};

function routeKey(method, path) {
  return `${method.toUpperCase()} ${path}`;
}

function ensureRoute(method, path) {
  const key = routeKey(method, path);
  if (!state.routes[key]) {
    state.routes[key] = {
      method: method.toUpperCase(),
      path,
      count: 0,
      errors: 0,
      avgMs: 0,
      maxMs: 0,
      lastStatus: 0,
      lastSeenAt: null,
    };
  }
  return state.routes[key];
}

export function observeHttpRequest({ method, path, statusCode, durationMs }) {
  const safeMethod = HTTP_METHODS.includes(String(method || '').toUpperCase()) ? method.toUpperCase() : 'OTHER';
  const safePath = String(path || '/');
  const safeStatus = Number(statusCode || 0);
  const safeDuration = Number(durationMs || 0);

  state.totals.requests += 1;
  if (safeStatus >= 500) {
    state.totals.errors += 1;
  }

  const route = ensureRoute(safeMethod, safePath);
  route.count += 1;
  if (safeStatus >= 400) {
    route.errors += 1;
  }
  route.avgMs = Number(((route.avgMs * (route.count - 1) + safeDuration) / route.count).toFixed(2));
  route.maxMs = Math.max(route.maxMs, Number(safeDuration.toFixed(2)));
  route.lastStatus = safeStatus;
  route.lastSeenAt = new Date().toISOString();
}

export function getMetricsSnapshot() {
  return {
    ...state,
    routes: Object.values(state.routes).sort((a, b) => b.count - a.count),
  };
}

export function observeDbQuery(durationMs, ok = true) {
  const safeDuration = Number(durationMs || 0);
  state.db.queries += 1;
  if (!ok) {
    state.db.errors += 1;
  }
  state.db.avgMs = Number(((state.db.avgMs * (state.db.queries - 1) + safeDuration) / state.db.queries).toFixed(2));
  state.db.maxMs = Math.max(state.db.maxMs, Number(safeDuration.toFixed(2)));
}
