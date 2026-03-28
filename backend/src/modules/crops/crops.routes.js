import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { runCropRecommendation } from './crops.engine.js';
import { getCropQueryHistory, saveCropQuery } from './crops.store.js';
import { validateRequest } from '../../lib/validate.js';

const router = Router();

const recommendBodySchema = z.object({
  soilType: z.string().trim().min(1).max(40),
  season: z.string().trim().min(1).max(40),
  temperatureC: z.number().min(-20).max(70),
  rainfallMm: z.number().min(0).max(10000),
  landSizeAcres: z.number().min(0.1).max(100000).optional(),
}).strict();

const historyQuerySchema = z.object({
  userId: z.string().trim().min(1).max(64).optional(),
});

function parseUser(req) {
  return req.headers['x-user-id'] || req.headers['x-user'] || 'anonymous';
}

router.post('/recommend', validateRequest({ body: recommendBodySchema }), (req, res) => {
  const { soilType, season, temperatureC, rainfallMm, landSizeAcres } = req.body || {};

  if (!soilType || !season || Number.isNaN(Number(temperatureC)) || Number.isNaN(Number(rainfallMm))) {
    return res.status(400).json({
      message: 'Invalid payload. Required: soilType, season, temperatureC, rainfallMm, landSizeAcres',
    });
  }

  const payload = {
    soilType: String(soilType),
    season: String(season),
    temperatureC: Number(temperatureC),
    rainfallMm: Number(rainfallMm),
    landSizeAcres: Number(landSizeAcres || 1),
  };

  const result = runCropRecommendation(payload);
  const userId = String(parseUser(req));

  saveCropQuery({
    id: randomUUID(),
    userId,
    createdAt: new Date().toISOString(),
    input: payload,
    topCrop: result.recommendations[0]?.cropKey || 'n/a',
  });

  return res.json(result);
});

router.get('/recommend/history', validateRequest({ query: historyQuerySchema }), (req, res) => {
  const userId = typeof req.query.userId === 'string' ? req.query.userId : String(parseUser(req));
  const history = getCropQueryHistory(userId);
  return res.json({ history });
});

export const cropRouter = router;
