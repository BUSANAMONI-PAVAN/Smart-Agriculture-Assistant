import { Router } from 'express';
import { z } from 'zod';
import { computeLifecycleSnapshot, registerLifecycleCrop } from './lifecycle.store.js';
import { validateRequest } from '../../lib/validate.js';

const router = Router();

const registerBodySchema = z.object({
  crop: z.string().trim().min(1).max(80),
  sowingDate: z.string().trim().min(8).max(20),
  areaAcres: z.number().min(0.1).max(100000).optional(),
  expectedHarvestDate: z.string().trim().min(8).max(20).optional(),
}).strict();

function getUserId(req) {
  return String(req.headers['x-user-id'] || req.query.userId || 'anonymous');
}

router.get('/current', (req, res) => {
  const data = computeLifecycleSnapshot(getUserId(req));
  res.json(data);
});

router.post('/register', validateRequest({ body: registerBodySchema }), (req, res) => {
  const row = registerLifecycleCrop(getUserId(req), req.body || {});
  res.status(201).json({ message: 'Crop lifecycle registered', cycle: row });
});

export const lifecycleRouter = router;
