const sensorStore = new Map();

export function ingestSensor(userId = 'anonymous', payload = {}) {
  const rows = sensorStore.get(userId) || [];
  const reading = {
    id: `${Date.now()}-${Math.round(Math.random() * 10000)}`,
    soilMoisture: Number(payload.soilMoisture || 0),
    airTempC: Number(payload.airTempC || 0),
    soilTempC: Number(payload.soilTempC || 0),
    humidity: Number(payload.humidity || 0),
    source: String(payload.source || 'manual'),
    createdAt: new Date().toISOString(),
  };
  rows.unshift(reading);
  sensorStore.set(userId, rows.slice(0, 80));
  return reading;
}

export function latestSensor(userId = 'anonymous') {
  const rows = sensorStore.get(userId) || [];
  return rows[0] || null;
}

export function listSensor(userId = 'anonymous') {
  return sensorStore.get(userId) || [];
}
