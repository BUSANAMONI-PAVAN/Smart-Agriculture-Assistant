import { Router } from 'express';
import { z } from 'zod';
import { getProfile, updateProfile } from './profile.store.js';
import { validateRequest } from '../../lib/validate.js';

const router = Router();

const updateProfileBodySchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().min(7).max(25).optional(),
  role: z.enum(['farmer', 'admin']).optional(),
  location: z.string().trim().min(1).max(160).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  landSizeAcres: z.number().min(0).max(100000).optional(),
  crops: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  cropPlans: z.array(z.object({
    cropName: z.string().trim().min(1).max(80),
    sowingDate: z.string().trim().min(4).max(20),
    stage: z.string().trim().min(1).max(80).optional(),
  })).max(24).optional(),
  notificationPreferences: z.object({
    weather: z.boolean().optional(),
    disease: z.boolean().optional(),
    lifecycle: z.boolean().optional(),
    personalized: z.boolean().optional(),
  }).optional(),
}).strict();

router.get('/me', async (req, res) => {
  const userId = String(req.auth?.user?.id || req.headers['x-user-id'] || 'anonymous');
  const profile = await getProfile(userId, req.auth?.user || {});
  res.json({
    ...profile,
    email: req.auth?.user?.email || profile.email,
    phone: req.auth?.user?.phone || profile.phone,
    role: req.auth?.user?.role || profile.role,
    status: req.auth?.user?.status || 'active',
    adminEnabled: req.auth?.user?.adminEnabled ?? false,
  });
});

router.put('/me', validateRequest({ body: updateProfileBodySchema }), async (req, res) => {
  const userId = String(req.auth?.user?.id || req.headers['x-user-id'] || 'anonymous');
  const profile = await updateProfile(userId, req.body || {}, req.auth?.user || {});
  res.json({ message: 'Profile updated', data: profile });
});

export const profileRouter = router;
