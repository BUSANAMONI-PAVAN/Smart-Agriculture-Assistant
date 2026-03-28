import { Router } from 'express';
import { z } from 'zod';
import { getBaseMarketData, getMarketQueryHistory, saveMarketQuery } from './market.store.js';
import { validateRequest } from '../../lib/validate.js';

const router = Router();

const marketQuerySchema = z.object({
  commodity: z.string().trim().min(1).max(80).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  areaAcres: z.coerce.number().min(0.1).max(100000).optional(),
  costPerAcre: z.coerce.number().min(1000).max(1_000_000).optional(),
});

const marketBodySchema = z.object({
  commodity: z.string().trim().min(1).max(80),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  areaAcres: z.number().min(0.1).max(100000),
  costPerAcre: z.number().min(1000).max(1_000_000),
}).strict();

const YIELD_MAP = {
  rice: 24,
  cotton: 10,
  chilli: 9,
  soybean: 12,
  maize: 20,
  onion: 105,
  turmeric: 24,
  banana: 125,
};

function toNumber(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function seasonalFactor(dayIndex) {
  const phase = (dayIndex / 14) * Math.PI * 2;
  return 1 + Math.sin(phase) * 0.018;
}

function stableNoise(seedString, dayIndex) {
  let hash = 0;
  const input = `${seedString}-${dayIndex}`;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return (Math.sin(hash) + 1) / 2;
}

function buildSeries(record) {
  return Array.from({ length: 14 }).map((_, idx) => {
    const trendBias = idx * (record.modalPrice * 0.0015);
    const noise = (stableNoise(`${record.market}-${record.commodity}`, idx) - 0.5) * (record.modalPrice * 0.016);
    const base = record.modalPrice * seasonalFactor(idx);
    const value = Math.max(1, Math.round(base + trendBias + noise));
    const date = new Date(Date.now() - (13 - idx) * 24 * 3600 * 1000).toISOString().slice(0, 10);
    return { date, price: value };
  });
}

function linearPredict(values, stepsAhead) {
  if (!values.length) return 0;
  if (values.length === 1) return values[0];

  const n = values.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i += 1) {
    const x = i;
    const y = values[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }
  const denominator = n * sumXX - sumX * sumX;
  const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  return Math.max(1, Math.round(intercept + slope * (n - 1 + stepsAhead)));
}

function buildMarketIntelligence({ commodity, lat, lng, areaAcres, costPerAcre }) {
  const base = getBaseMarketData().filter((item) => item.commodity === commodity);
  const fallbackBase = base.length ? base : getBaseMarketData().filter((item) => item.commodity === 'rice');
  const yieldQPerAcre = YIELD_MAP[commodity] || 18;
  const commoditySeriesMatrix = [];

  const markets = fallbackBase.map((record) => {
    const series = buildSeries(record);
    const prices = series.map((item) => item.price);
    commoditySeriesMatrix.push(series);

    const first = prices[0];
    const last = prices[prices.length - 1];
    const trend7d = first > 0 ? Number((((last - first) / first) * 100).toFixed(2)) : 0;
    const predictedPrice7d = linearPredict(prices, 7);
    const minPrice = Math.round(last * 0.96);
    const maxPrice = Math.round(last * 1.04);
    const distanceKm = lat && lng ? haversineKm(lat, lng, record.lat, record.lng) : null;

    const transportPenaltyPerQ = distanceKm ? Math.min(160, distanceKm * 1.2) : 0;
    const effectiveSellPrice = Math.max(1, Math.round(last - transportPenaltyPerQ));
    const grossIncome = Math.round(areaAcres * yieldQPerAcre * effectiveSellPrice);
    const logisticsCost = Math.round((distanceKm || 0) * areaAcres * 20);
    const totalCost = Math.round(areaAcres * costPerAcre + logisticsCost);
    const netProfit = grossIncome - totalCost;

    return {
      market: record.market,
      district: record.district,
      state: record.state,
      latitude: record.lat,
      longitude: record.lng,
      modalPrice: last,
      minPrice,
      maxPrice,
      trend7d,
      predictedPrice7d,
      predictionConfidence: Math.min(92, Math.max(64, 84 - Math.abs(trend7d))),
      distanceKm: distanceKm ? Number(distanceKm.toFixed(1)) : null,
      requiredYieldQPerAcre: yieldQPerAcre,
      economics: {
        effectiveSellPrice,
        grossIncome,
        totalCost,
        netProfit,
      },
      series,
    };
  });

  const sorted = [...markets].sort((a, b) => {
    if (b.economics.netProfit !== a.economics.netProfit) {
      return b.economics.netProfit - a.economics.netProfit;
    }
    return b.modalPrice - a.modalPrice;
  });

  const bestMarket = sorted[0] || null;
  const marketsWithFlag = sorted.map((item, idx) => ({ ...item, recommended: idx === 0 }));

  const trendSeries = Array.from({ length: 14 }).map((_, idx) => {
    const date = marketsWithFlag[0]?.series[idx]?.date || new Date().toISOString().slice(0, 10);
    const avgPrice =
      marketsWithFlag.length > 0
        ? Math.round(marketsWithFlag.reduce((sum, row) => sum + row.series[idx].price, 0) / marketsWithFlag.length)
        : 0;
    return {
      date,
      avgPrice,
      predictedPrice: idx < 10 ? null : linearPredict(trendSeriesSeed(marketsWithFlag, idx), idx - 9),
    };
  });

  const futurePrediction = linearPredict(trendSeries.map((row) => row.avgPrice), 7);
  const insights = [
    `Best market today: ${bestMarket?.market || 'N/A'} for ${commodity}.`,
    `Expected average price after 7 days: INR ${futurePrediction.toLocaleString()} per quintal.`,
    bestMarket ? `Estimated net profit at best market: INR ${bestMarket.economics.netProfit.toLocaleString()}.` : 'No market data found.',
  ];

  return {
    commodity,
    updatedAt: new Date().toISOString(),
    yieldQPerAcre,
    trendSeries,
    futurePrediction,
    bestMarket,
    markets: marketsWithFlag,
    insights,
    prices: marketsWithFlag.map((item) => ({
      market: item.market,
      commodity,
      price: item.modalPrice,
      trend7d: item.trend7d,
    })),
  };
}

function trendSeriesSeed(markets, uptoIndex) {
  return markets.map((item) => item.series[Math.max(0, Math.min(uptoIndex, item.series.length - 1))]?.price || 0);
}

router.get('/prices', validateRequest({ query: marketQuerySchema }), (req, res) => {
  const commodity = String(req.query.commodity || 'rice').toLowerCase();
  const lat = toNumber(req.query.lat, 0);
  const lng = toNumber(req.query.lng, 0);
  const areaAcres = Math.max(0.1, toNumber(req.query.areaAcres, 2));
  const costPerAcre = Math.max(1000, toNumber(req.query.costPerAcre, 25000));

  const payload = buildMarketIntelligence({ commodity, lat, lng, areaAcres, costPerAcre });
  res.json(payload);
});

router.post('/queries', validateRequest({ body: marketBodySchema }), (req, res) => {
  const body = req.body || {};
  const userId = String(req.headers['x-user-id'] || 'anonymous');
  const commodity = String(body.commodity || 'rice').toLowerCase();
  const lat = toNumber(body.lat, 0);
  const lng = toNumber(body.lng, 0);
  const areaAcres = Math.max(0.1, toNumber(body.areaAcres, 2));
  const costPerAcre = Math.max(1000, toNumber(body.costPerAcre, 25000));

  const intelligence = buildMarketIntelligence({ commodity, lat, lng, areaAcres, costPerAcre });
  const entry = {
    id: `${Date.now()}-${Math.round(Math.random() * 100000)}`,
    userId,
    commodity,
    lat,
    lng,
    areaAcres,
    costPerAcre,
    bestMarket: intelligence.bestMarket?.market || null,
    bestNetProfit: intelligence.bestMarket?.economics?.netProfit || null,
    createdAt: new Date().toISOString(),
  };
  saveMarketQuery(entry);

  res.status(201).json({ message: 'Market query stored', query: entry });
});

router.get('/queries/history', validateRequest({ query: z.object({ userId: z.string().trim().min(1).max(64).optional() }) }), (req, res) => {
  const userId = String(req.headers['x-user-id'] || 'anonymous');
  res.json({ history: getMarketQueryHistory(userId) });
});

export const marketRouter = router;
