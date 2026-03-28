const digitalTwinStore = new Map();

function defaultTwin(userId) {
  return {
    userId,
    landProfile: {
      village: 'Hyderabad Rural',
      district: 'Ranga Reddy',
      state: 'Telangana',
      latitude: 17.385,
      longitude: 78.4867,
      landSizeAcres: 3,
      irrigationSource: 'Borewell',
      soilType: 'loamy',
      soilPh: 6.8,
      soilOrganicCarbon: 0.62,
    },
    seasonalPatterns: {
      kharifRainfallMm: 640,
      rabiRainfallMm: 120,
      avgSummerTempC: 36,
    },
    cropHistory: [
      { season: 'kharif-2024', crop: 'rice', areaAcres: 2, yieldQPerAcre: 23 },
      { season: 'rabi-2024', crop: 'maize', areaAcres: 1.5, yieldQPerAcre: 20 },
    ],
    yieldRecords: [
      { crop: 'rice', season: 'kharif-2024', expectedYieldQ: 44, actualYieldQ: 42, lossPercent: 4.5 },
    ],
    updatedAt: new Date().toISOString(),
  };
}

export function getDigitalTwin(userId = 'anonymous') {
  if (!digitalTwinStore.has(userId)) {
    digitalTwinStore.set(userId, defaultTwin(userId));
  }
  return digitalTwinStore.get(userId);
}

export function updateLandProfile(userId = 'anonymous', patch = {}) {
  const current = getDigitalTwin(userId);
  const next = {
    ...current,
    landProfile: {
      ...current.landProfile,
      ...(patch.landProfile || {}),
    },
    seasonalPatterns: {
      ...current.seasonalPatterns,
      ...(patch.seasonalPatterns || {}),
    },
    cropHistory: Array.isArray(patch.cropHistory) ? patch.cropHistory.slice(0, 80) : current.cropHistory,
    updatedAt: new Date().toISOString(),
  };
  digitalTwinStore.set(userId, next);
  return next;
}

export function addYieldRecord(userId = 'anonymous', payload = {}) {
  const current = getDigitalTwin(userId);
  const record = {
    crop: String(payload.crop || 'unknown'),
    season: String(payload.season || 'unknown'),
    expectedYieldQ: Number(payload.expectedYieldQ || 0),
    actualYieldQ: Number(payload.actualYieldQ || 0),
    lossPercent: Number(payload.lossPercent || 0),
    createdAt: new Date().toISOString(),
  };
  current.yieldRecords.unshift(record);
  if (current.yieldRecords.length > 120) {
    current.yieldRecords.length = 120;
  }
  current.updatedAt = new Date().toISOString();
  digitalTwinStore.set(userId, current);
  return record;
}
