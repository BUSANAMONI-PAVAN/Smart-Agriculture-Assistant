import { Router } from 'express';
import { z } from 'zod';
import { getBaseMarketData } from '../market/market.store.js';
import { addIngestionEvent, getDataPipelineState, setNormalized } from './data.store.js';
import { validateRequest } from '../../lib/validate.js';

const router = Router();

const ingestWeatherBodySchema = z.object({
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
}).strict();

const ingestMarketBodySchema = z.object({
  commodity: z.string().trim().min(1).max(80).optional(),
}).strict();

router.get('/sources', (_req, res) => {
  res.json(getDataPipelineState());
});

router.post('/ingest/weather', validateRequest({ body: ingestWeatherBodySchema }), async (req, res) => {
  const lat = Number(req.body?.lat || 17.385);
  const lng = Number(req.body?.lng || 78.4867);
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code,relative_humidity_2m&timezone=auto`,
    );
    const payload = await response.json();
    const normalized = {
      lat,
      lng,
      tempC: Number(payload?.current?.temperature_2m || 0),
      humidity: Number(payload?.current?.relative_humidity_2m || 0),
      weatherCode: Number(payload?.current?.weather_code || 0),
      source: 'open-meteo',
    };
    setNormalized('weather', normalized);
    addIngestionEvent({ source: 'weather', status: 'success' });
    res.json({ message: 'Weather ingested', data: normalized });
  } catch (error) {
    addIngestionEvent({ source: 'weather', status: 'failed', detail: error?.message || 'error' });
    res.status(502).json({ message: 'Weather ingestion failed' });
  }
});

router.post('/ingest/market', validateRequest({ body: ingestMarketBodySchema }), (req, res) => {
  const commodity = String(req.body?.commodity || 'rice').toLowerCase();
  const rows = getBaseMarketData().filter((item) => item.commodity === commodity);
  const avg = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.modalPrice, 0) / rows.length) : 0;
  const normalized = { commodity, markets: rows.length, avgPrice: avg, source: 'mandi-benchmark' };
  setNormalized('market', normalized);
  addIngestionEvent({ source: 'market', status: 'success' });
  res.json({ message: 'Market data ingested', data: normalized });
});

router.get('/normalized/latest', (_req, res) => {
  res.json(getDataPipelineState().normalized);
});

export const dataRouter = router;
