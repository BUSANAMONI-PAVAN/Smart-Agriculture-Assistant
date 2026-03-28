import { Router } from 'express';
import { z } from 'zod';
import { addYieldRecord, getDigitalTwin, updateLandProfile } from './digitalTwin.store.js';
import { validateRequest } from '../../lib/validate.js';

const router = Router();

const updateTwinBodySchema = z.object({
  landProfile: z.object({
    village: z.string().trim().min(1).max(120).optional(),
    district: z.string().trim().min(1).max(120).optional(),
    state: z.string().trim().min(1).max(120).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    landSizeAcres: z.number().min(0).max(100000).optional(),
    irrigationSource: z.string().trim().min(1).max(80).optional(),
    soilType: z.string().trim().min(1).max(80).optional(),
    soilPh: z.number().min(0).max(14).optional(),
    soilOrganicCarbon: z.number().min(0).max(100).optional(),
  }).optional(),
  seasonalPatterns: z.object({
    kharifRainfallMm: z.number().min(0).max(10000).optional(),
    rabiRainfallMm: z.number().min(0).max(10000).optional(),
    avgSummerTempC: z.number().min(-20).max(70).optional(),
  }).optional(),
  cropHistory: z.array(z.object({
    season: z.string().trim().min(1).max(80),
    crop: z.string().trim().min(1).max(80),
    areaAcres: z.number().min(0.01).max(100000),
    yieldQPerAcre: z.number().min(0).max(100000),
  })).max(80).optional(),
}).strict();

const yieldBodySchema = z.object({
  crop: z.string().trim().min(1).max(80),
  season: z.string().trim().min(1).max(80),
  expectedYieldQ: z.number().min(0).max(100000),
  actualYieldQ: z.number().min(0).max(100000),
  lossPercent: z.number().min(0).max(100),
}).strict();

function userFromReq(req) {
  return String(req.headers['x-user-id'] || req.query.userId || 'anonymous');
}

router.get('/profile', (req, res) => {
  const twin = getDigitalTwin(userFromReq(req));
  res.json(twin);
});

router.put('/profile', validateRequest({ body: updateTwinBodySchema }), (req, res) => {
  const twin = updateLandProfile(userFromReq(req), req.body || {});
  res.json({ message: 'Digital twin updated', data: twin });
});

router.post('/yield-records', validateRequest({ body: yieldBodySchema }), (req, res) => {
  const record = addYieldRecord(userFromReq(req), req.body || {});
  res.status(201).json({ message: 'Yield record saved', record });
});

export const digitalTwinRouter = router;
