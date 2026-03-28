import { Router } from 'express';
import { z } from 'zod';
import { ingestSensor, latestSensor, listSensor } from './iot.store.js';
import { validateRequest } from '../../lib/validate.js';

const router = Router();

const ingestBodySchema = z.object({
  soilMoisture: z.number().min(0).max(100),
  airTempC: z.number().min(-50).max(80),
  soilTempC: z.number().min(-20).max(80),
  humidity: z.number().min(0).max(100),
  source: z.string().trim().min(1).max(80).optional(),
}).strict();

const optionalUserQuerySchema = z.object({
  userId: z.string().trim().min(1).max(64).optional(),
});

function user(req) {
  return String(req.headers['x-user-id'] || req.query.userId || 'anonymous');
}

function irrigationAdvice(reading) {
  if (!reading) {
    return {
      action: 'monitor',
      message: 'No sensor data yet. Use field moisture check before irrigation.',
      confidence: 0.4,
    };
  }
  if (reading.soilMoisture < 22) {
    return {
      action: 'irrigate',
      message: 'Soil moisture is low. Start irrigation in cool hours today.',
      confidence: 0.9,
    };
  }
  if (reading.soilMoisture > 52) {
    return {
      action: 'hold',
      message: 'Soil moisture is already high. Hold irrigation and improve drainage.',
      confidence: 0.88,
    };
  }
  return {
    action: 'normal',
    message: 'Soil moisture is in normal range. Continue planned schedule.',
    confidence: 0.76,
  };
}

router.post('/sensors', validateRequest({ body: ingestBodySchema }), (req, res) => {
  const reading = ingestSensor(user(req), req.body || {});
  res.status(201).json({ message: 'Sensor data ingested', reading });
});

router.get('/sensors/latest', validateRequest({ query: optionalUserQuerySchema }), (req, res) => {
  const reading = latestSensor(user(req));
  res.json({ reading });
});

router.get('/advisory', validateRequest({ query: optionalUserQuerySchema }), (req, res) => {
  const reading = latestSensor(user(req));
  const advisory = irrigationAdvice(reading);
  res.json({
    advisory,
    reading,
    source: reading ? 'iot-sensor' : 'fallback-rule',
    generatedAt: new Date().toISOString(),
  });
});

router.get('/sensors/history', validateRequest({ query: optionalUserQuerySchema }), (req, res) => {
  res.json({ readings: listSensor(user(req)) });
});

export const iotRouter = router;
