const ingestionLog = [];
const normalizedStore = {
  weather: null,
  market: null,
  soil: null,
};

export function addIngestionEvent(event) {
  ingestionLog.unshift({
    id: `${Date.now()}-${Math.round(Math.random() * 1000)}`,
    ...event,
    at: new Date().toISOString(),
  });
  if (ingestionLog.length > 200) {
    ingestionLog.length = 200;
  }
}

export function setNormalized(name, payload) {
  normalizedStore[name] = {
    payload,
    at: new Date().toISOString(),
  };
}

export function getDataPipelineState() {
  return {
    sources: [
      { key: 'weather', status: normalizedStore.weather ? 'active' : 'idle' },
      { key: 'market', status: normalizedStore.market ? 'active' : 'idle' },
      { key: 'soil', status: normalizedStore.soil ? 'planned' : 'planned' },
    ],
    normalized: normalizedStore,
    logs: ingestionLog.slice(0, 80),
  };
}
