export type AlertLevel = 'low' | 'medium' | 'high';

export type AppAlert = {
  id: string;
  type: 'weather' | 'disease' | 'crop' | 'lifecycle' | 'market' | 'system';
  level: AlertLevel;
  message: string;
  createdAt: string;
};

const ALERTS_KEY = 'smartAgriAlerts';
const MANAGER_ALERTS_KEY = 'managerAlerts';
const ALERT_COOLDOWN_KEY = 'smartAgriAlertCooldown';

const COOLDOWN_BY_LEVEL_MS: Record<AlertLevel, number> = {
  high: 2 * 60 * 60 * 1000,
  medium: 6 * 60 * 60 * 1000,
  low: 12 * 60 * 60 * 1000,
};

export function createAlert(alert: Omit<AppAlert, 'id' | 'createdAt'>) {
  const payload: AppAlert = {
    ...alert,
    id: `${Date.now()}-${Math.round(Math.random() * 100000)}`,
    createdAt: new Date().toISOString(),
  };

  const current = readAlerts();
  localStorage.setItem(ALERTS_KEY, JSON.stringify([payload, ...current].slice(0, 200)));

  const managerCurrent = readManagerAlerts();
  localStorage.setItem(MANAGER_ALERTS_KEY, JSON.stringify([payload, ...managerCurrent].slice(0, 300)));

  return payload;
}

export function readAlerts(): AppAlert[] {
  try {
    const raw = localStorage.getItem(ALERTS_KEY);
    return raw ? (JSON.parse(raw) as AppAlert[]) : [];
  } catch {
    return [];
  }
}

export function readManagerAlerts(): AppAlert[] {
  try {
    const raw = localStorage.getItem(MANAGER_ALERTS_KEY);
    return raw ? (JSON.parse(raw) as AppAlert[]) : [];
  } catch {
    return [];
  }
}

export function shouldTriggerAlert(signature: string, level: AlertLevel) {
  try {
    const raw = localStorage.getItem(ALERT_COOLDOWN_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    const now = Date.now();
    const last = map[signature] || 0;
    if (now - last < COOLDOWN_BY_LEVEL_MS[level]) {
      return false;
    }
    map[signature] = now;
    localStorage.setItem(ALERT_COOLDOWN_KEY, JSON.stringify(map));
    return true;
  } catch {
    return true;
  }
}
