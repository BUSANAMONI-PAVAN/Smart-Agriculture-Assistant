const cropCatalog = [
  {
    key: 'rice',
    label: 'Rice',
    soils: ['loamy', 'clay', 'silt'],
    seasons: ['kharif'],
    tempRange: [22, 34],
    rainRange: [900, 1800],
    water: 'High: 1100-1400 mm seasonal water requirement',
    fertilizer: 'NPK 120:60:40 kg/ha (split nitrogen doses)',
    yieldPerAcreQ: [18, 26],
    riskHint: 'Sensitive to late-season water stress and stem borer pressure.',
    why: 'Performs best in monsoon with consistent soil moisture.',
  },
  {
    key: 'maize',
    label: 'Maize',
    soils: ['loamy', 'sandy', 'black'],
    seasons: ['kharif', 'rabi', 'zaid'],
    tempRange: [18, 35],
    rainRange: [500, 900],
    water: 'Medium: 450-600 mm with critical irrigation at tasseling',
    fertilizer: 'NPK 90:45:30 kg/ha + Zn in deficient soils',
    yieldPerAcreQ: [16, 24],
    riskHint: 'Watch for fall armyworm in humid weather.',
    why: 'Flexible season crop with stable market demand and moderate water use.',
  },
  {
    key: 'cotton',
    label: 'Cotton',
    soils: ['black', 'loamy'],
    seasons: ['kharif'],
    tempRange: [21, 36],
    rainRange: [600, 1100],
    water: 'Medium-high: moisture needed at flowering and boll formation',
    fertilizer: 'NPK 100:50:50 kg/ha + micronutrients as per soil test',
    yieldPerAcreQ: [8, 13],
    riskHint: 'Pink bollworm and sucking pest monitoring is essential.',
    why: 'Black soils and warm weather strongly favor boll development.',
  },
  {
    key: 'groundnut',
    label: 'Groundnut',
    soils: ['sandy', 'red', 'loamy'],
    seasons: ['kharif', 'zaid'],
    tempRange: [20, 34],
    rainRange: [500, 900],
    water: 'Medium: avoid waterlogging and ensure pod-filling irrigation',
    fertilizer: 'NPK 25:50:75 kg/ha + gypsum during flowering',
    yieldPerAcreQ: [7, 10],
    riskHint: 'Leaf spot and collar rot risk in prolonged humidity.',
    why: 'Suitable for well-drained soils and gives good oilseed returns.',
  },
  {
    key: 'chickpea',
    label: 'Chickpea',
    soils: ['black', 'red', 'loamy', 'sandy'],
    seasons: ['rabi'],
    tempRange: [15, 30],
    rainRange: [350, 650],
    water: 'Low-medium: one irrigation at branching if dry',
    fertilizer: 'DAP basal dose + Rhizobium seed treatment',
    yieldPerAcreQ: [6, 9],
    riskHint: 'Pod borer and wilt in poorly drained fields.',
    why: 'Profitable rabi pulse with lower input requirement.',
  },
  {
    key: 'sunflower',
    label: 'Sunflower',
    soils: ['black', 'red', 'sandy', 'loamy'],
    seasons: ['rabi', 'zaid'],
    tempRange: [18, 33],
    rainRange: [450, 800],
    water: 'Medium: irrigation at bud and flowering stage',
    fertilizer: 'NPK 60:90:60 kg/ha with boron in deficient soils',
    yieldPerAcreQ: [4, 7],
    riskHint: 'Bird damage and head borer during seed formation.',
    why: 'Oilseed crop with climate adaptability and low crop duration.',
  },
  {
    key: 'sugarcane',
    label: 'Sugarcane',
    soils: ['loamy', 'clay', 'black'],
    seasons: ['kharif', 'zaid'],
    tempRange: [20, 38],
    rainRange: [900, 1500],
    water: 'Very high: scheduled irrigation with drip preferred',
    fertilizer: 'NPK 250:100:120 kg/ha in splits + organic matter',
    yieldPerAcreQ: [280, 420],
    riskHint: 'Red rot and early shoot borer in unmanaged fields.',
    why: 'High biomass crop with strong mill demand in irrigated regions.',
  },
  {
    key: 'tomato',
    label: 'Tomato',
    soils: ['loamy', 'sandy', 'red'],
    seasons: ['rabi', 'zaid'],
    tempRange: [18, 32],
    rainRange: [450, 850],
    water: 'Medium-high: regular irrigation without waterlogging',
    fertilizer: 'NPK 100:60:60 kg/ha + calcium and boron sprays',
    yieldPerAcreQ: [100, 160],
    riskHint: 'Price volatility and blight in humid spells.',
    why: 'Short-duration, high-value vegetable suitable for market-linked farmers.',
  },
];

const marketPricePerQuintal = {
  rice: 2300,
  maize: 2350,
  cotton: 6700,
  groundnut: 6100,
  chickpea: 6300,
  sunflower: 5400,
  sugarcane: 360,
  tomato: 2200,
};

function scoreCrop(crop, payload) {
  const soilScore = crop.soils.includes(payload.soilType) ? 35 : 10;
  const seasonScore = crop.seasons.includes(payload.season) ? 25 : 8;

  const [tMin, tMax] = crop.tempRange;
  const [rMin, rMax] = crop.rainRange;

  const tempScore = payload.temperatureC >= tMin && payload.temperatureC <= tMax ? 25 : 10;
  const rainScore = payload.rainfallMm >= rMin && payload.rainfallMm <= rMax ? 15 : 6;

  const suitability = Math.min(100, soilScore + seasonScore + tempScore + rainScore);

  let risk = 'Low';
  if (suitability < 55) risk = 'High';
  else if (suitability < 75) risk = 'Medium';

  const yieldMid = Math.round((crop.yieldPerAcreQ[0] + crop.yieldPerAcreQ[1]) / 2);
  const estimatedYield = Math.max(1, Math.round(yieldMid * (suitability / 100) * 10) / 10);

  const marketPrice = marketPricePerQuintal[crop.key] || 2000;
  const grossIncome = Math.round(estimatedYield * marketPrice);
  const estimatedCost = Math.round(payload.landSizeAcres * 11000 + marketPrice * 0.12);
  const netProfit = grossIncome - estimatedCost;

  return {
    cropKey: crop.key,
    cropLabel: crop.label,
    suitabilityScore: suitability,
    riskLevel: risk,
    expectedYieldQPerAcre: `${estimatedYield} q/acre`,
    requiredWater: crop.water,
    requiredFertilizer: crop.fertilizer,
    whyRecommended: crop.why,
    riskNote: crop.riskHint,
    economics: {
      marketPricePerQuintal: marketPrice,
      estimatedCost,
      grossIncome,
      netProfit,
    },
  };
}

export function runCropRecommendation(payload) {
  const scored = cropCatalog
    .map((crop) => scoreCrop(crop, payload))
    .sort((a, b) => b.suitabilityScore - a.suitabilityScore)
    .slice(0, 4);

  const advisory = [];
  if (payload.rainfallMm > 950) advisory.push('High rainfall outlook: prioritize drainage-ready crops and avoid over-irrigation.');
  if (payload.temperatureC > 38) advisory.push('Heat stress risk: use mulching and shift irrigation to early morning.');
  if (!advisory.length) advisory.push('Weather conditions are favorable. Follow stage-wise nutrient and irrigation plan.');

  return {
    querySummary: {
      soilType: payload.soilType,
      season: payload.season,
      temperatureC: payload.temperatureC,
      rainfallMm: payload.rainfallMm,
      landSizeAcres: payload.landSizeAcres,
    },
    recommendations: scored,
    advisory,
  };
}
