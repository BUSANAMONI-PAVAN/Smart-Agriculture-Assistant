const lifecycleStore = new Map();

const STAGE_PLAN = {
  rice: [
    { stage: 'sowing', dayStart: 0, dayEnd: 20 },
    { stage: 'vegetative', dayStart: 21, dayEnd: 55 },
    { stage: 'flowering', dayStart: 56, dayEnd: 85 },
    { stage: 'grain-fill', dayStart: 86, dayEnd: 110 },
    { stage: 'harvest', dayStart: 111, dayEnd: 140 },
  ],
  cotton: [
    { stage: 'sowing', dayStart: 0, dayEnd: 25 },
    { stage: 'vegetative', dayStart: 26, dayEnd: 70 },
    { stage: 'square-formation', dayStart: 71, dayEnd: 110 },
    { stage: 'boll-development', dayStart: 111, dayEnd: 150 },
    { stage: 'harvest', dayStart: 151, dayEnd: 190 },
  ],
};

function stagePlan(crop) {
  return STAGE_PLAN[String(crop || '').toLowerCase()] || [
    { stage: 'sowing', dayStart: 0, dayEnd: 20 },
    { stage: 'growth', dayStart: 21, dayEnd: 70 },
    { stage: 'harvest', dayStart: 71, dayEnd: 120 },
  ];
}

function stageTasks(crop, stage) {
  const key = `${String(crop || '').toLowerCase()}:${stage}`;
  const map = {
    'rice:sowing': ['Seed treatment before sowing', 'Maintain shallow water layer'],
    'rice:vegetative': ['Top dress urea based on soil test', 'Weed control during early growth'],
    'rice:flowering': ['Avoid water stress at panicle initiation', 'Monitor blast and sheath blight'],
    'rice:grain-fill': ['Balanced moisture and potassium support', 'Bird and pest protection'],
    'rice:harvest': ['Drain field 7-10 days before harvest', 'Schedule harvest around dry weather'],
    'cotton:sowing': ['Use recommended seed spacing', 'Install pheromone traps'],
    'cotton:vegetative': ['Split nitrogen application', 'Scout for sucking pests twice weekly'],
    'cotton:square-formation': ['Avoid moisture stress', 'Micronutrient spray if needed'],
    'cotton:boll-development': ['Drip/furrow irrigation at intervals', 'Monitor bollworm and protect bolls'],
    'cotton:harvest': ['Pick fully opened bolls only', 'Keep kapas dry before storage'],
  };
  return map[key] || ['Follow stage-wise irrigation and nutrient plan', 'Inspect field condition every 2-3 days'];
}

function getDayAge(sowingDate) {
  const start = Date.parse(String(sowingDate || ''));
  if (!Number.isFinite(start)) return 0;
  const days = Math.floor((Date.now() - start) / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

export function getLifecycle(userId = 'anonymous') {
  return lifecycleStore.get(userId) || [];
}

export function registerLifecycleCrop(userId = 'anonymous', payload = {}) {
  const row = {
    id: `${Date.now()}-${Math.round(Math.random() * 10000)}`,
    crop: String(payload.crop || 'unknown').toLowerCase(),
    sowingDate: String(payload.sowingDate || new Date().toISOString().slice(0, 10)),
    areaAcres: Number(payload.areaAcres || 1),
    expectedHarvestDate: String(payload.expectedHarvestDate || ''),
    updatedAt: new Date().toISOString(),
  };
  const rows = getLifecycle(userId);
  rows.unshift(row);
  lifecycleStore.set(userId, rows.slice(0, 24));
  return row;
}

export function computeLifecycleSnapshot(userId = 'anonymous') {
  const rows = getLifecycle(userId);
  const cycles = rows.map((row) => {
    const days = getDayAge(row.sowingDate);
    const plan = stagePlan(row.crop);
    const current = plan.find((item) => days >= item.dayStart && days <= item.dayEnd) || plan[plan.length - 1];
    const nextStage = plan.find((item) => item.dayStart > current.dayStart) || null;
    const progress = Math.min(100, Math.max(0, Math.round((days / (plan[plan.length - 1].dayEnd || 120)) * 100)));
    return {
      ...row,
      dayAge: days,
      stage: current.stage,
      progress,
      nextStage: nextStage?.stage || 'completed',
      tasks: stageTasks(row.crop, current.stage),
      reasoning: `Stage derived from ${days} days after sowing for ${row.crop}.`,
      confidence: 0.84,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    cycles,
  };
}
