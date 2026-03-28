import { Router } from 'express';
import { z } from 'zod';
import { addDiseaseScan, listDiseaseScansByUser } from './disease.store.js';
import { inferDisease } from './disease.ai.js';
import { validateRequest } from '../../lib/validate.js';

const router = Router();

const analyzeBodySchema = z.object({
  userId: z.string().trim().min(1).max(64).optional(),
  imageData: z.string().trim().min(30).max(6_000_000),
  imageUrl: z.string().trim().min(30).max(6_000_000).optional(),
  crop: z.string().trim().min(1).max(80).optional(),
}).strict();

const saveScanBodySchema = z.object({
  userId: z.string().trim().min(1).max(64).optional(),
  crop: z.string().trim().min(1).max(80).optional(),
  diseaseKey: z.string().trim().min(1).max(80),
  confidence: z.number().min(0).max(100),
  level: z.enum(['low', 'medium', 'high']),
  imageUrl: z.string().trim().max(6_000_000).nullable().optional(),
  notes: z.string().trim().max(1500).optional(),
}).strict();

const historyQuerySchema = z.object({
  userId: z.string().trim().min(1).max(64).optional(),
});

router.post('/analyze', validateRequest({ body: analyzeBodySchema }), async (req, res) => {
  const payload = req.body || {};
  const userId = String(req.headers['x-user-id'] || payload.userId || 'anonymous');
  const imageData = String(payload.imageData || payload.imageUrl || '');
  const crop = String(payload.crop || 'unknown');

  if (!imageData) {
    return res.status(400).json({ message: 'imageData is required' });
  }

  const prediction = await inferDisease({ imageData, crop });
  const level = prediction.diseaseKey === 'healthy' ? 'low' : prediction.confidence >= 82 ? 'high' : 'medium';

  const scan = addDiseaseScan({
    userId,
    crop,
    diseaseKey: prediction.diseaseKey,
    confidence: prediction.confidence,
    level,
    imageUrl: imageData,
    notes: `Inference source: ${prediction.source}`,
  });

  return res.json({
    prediction: {
      diseaseKey: prediction.diseaseKey,
      diseaseName: prediction.diseaseName,
      confidence: prediction.confidence,
      cause: prediction.cause,
      treatment: prediction.treatment,
      prevention: prediction.prevention,
      level,
      source: prediction.source,
    },
    scan,
  });
});

router.post('/scans', validateRequest({ body: saveScanBodySchema }), (req, res) => {
  const payload = req.body || {};
  const userId = String(req.headers['x-user-id'] || payload.userId || 'anonymous');

  const scan = addDiseaseScan({
    userId,
    crop: String(payload.crop || 'unknown'),
    diseaseKey: String(payload.diseaseKey || 'unknown'),
    confidence: Number(payload.confidence || 0),
    level: String(payload.level || 'low'),
    imageUrl: payload.imageUrl || null,
    notes: String(payload.notes || ''),
  });

  res.status(201).json({ message: 'Disease scan logged', scan });
});

router.get('/history', validateRequest({ query: historyQuerySchema }), (req, res) => {
  const userId = String(req.headers['x-user-id'] || req.query.userId || 'anonymous');
  const scans = listDiseaseScansByUser(userId);
  res.json({ scans });
});

export const diseaseRouter = router;
