const diseaseScanStore = [];
const MAX_SCANS = 2000;

export function addDiseaseScan(payload) {
  const scan = {
    id: `${Date.now()}-${Math.round(Math.random() * 100000)}`,
    userId: payload.userId || 'anonymous',
    crop: payload.crop || 'unknown',
    diseaseKey: payload.diseaseKey || 'unknown',
    confidence: Number(payload.confidence || 0),
    level: payload.level || 'low',
    imageUrl: payload.imageUrl || null,
    notes: payload.notes || '',
    createdAt: new Date().toISOString(),
  };

  diseaseScanStore.unshift(scan);
  if (diseaseScanStore.length > MAX_SCANS) {
    diseaseScanStore.length = MAX_SCANS;
  }
  return scan;
}

export function listDiseaseScansByUser(userId) {
  return diseaseScanStore.filter((scan) => scan.userId === userId).slice(0, 200);
}

export function listRecentHighRiskScans(userId, hours = 48) {
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  return diseaseScanStore.filter((scan) => {
    if (scan.userId !== userId) return false;
    if (scan.level !== 'high') return false;
    return Date.parse(scan.createdAt) >= cutoff;
  });
}
