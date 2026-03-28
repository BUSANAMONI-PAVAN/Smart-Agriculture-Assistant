import { Router } from 'express';
import { z } from 'zod';
import { addAlert, deleteAlert, getAlerts, getAlertsDebugState, markAlertRead, shouldStoreAlert, subscribeToAlerts } from './alerts.store.js';
import { getSchedulerDebugState, runAlertSchedulerNow } from './alerts.scheduler.js';
import { validateRequest } from '../../lib/validate.js';

const router = Router();

const listQuerySchema = z.object({
  source: z.string().trim().min(1).max(80).optional(),
});

const ingestBodySchema = z.object({
  type: z.enum(['weather', 'disease', 'crop', 'lifecycle', 'market', 'system']),
  level: z.enum(['low', 'medium', 'high']),
  title: z.string().trim().min(1).max(160),
  message: z.string().trim().min(1).max(2000),
  source: z.string().trim().min(1).max(80).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict();

const idParamsSchema = z.object({
  id: z.string().trim().min(1).max(64),
});

router.get('/stream', (req, res) => {
  const userId = String(req.auth?.user?.id || req.headers['x-user-id'] || 'anonymous');

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  res.write(`event: ready\ndata: ${JSON.stringify({ connected: true, userId })}\n\n`);

  const unsubscribe = subscribeToAlerts((alert) => {
    if (alert.userId !== userId) {
      return;
    }
    res.write(`event: alert\ndata: ${JSON.stringify(alert)}\n\n`);
  });

  const ping = setInterval(() => {
    res.write(`event: ping\ndata: ${JSON.stringify({ now: new Date().toISOString() })}\n\n`);
  }, 30000);

  req.on('close', () => {
    clearInterval(ping);
    unsubscribe();
    res.end();
  });
});

router.get('/', validateRequest({ query: listQuerySchema }), async (req, res) => {
  const source = typeof req.query.source === 'string' ? req.query.source : null;
  const userId = String(req.auth?.user?.id || req.headers['x-user-id'] || 'anonymous');
  const alerts = await getAlerts({ source, userId });
  res.json({ alerts });
});

router.post('/ingest', validateRequest({ body: ingestBodySchema }), async (req, res) => {
  const payload = req.body || {};
  const userId = String(req.auth?.user?.id || req.headers['x-user-id'] || 'anonymous');

  const alertInput = {
    userId,
    type: String(payload.type || 'system'),
    level: String(payload.level || 'medium'),
    title: String(payload.title || 'Notification'),
    message: String(payload.message || 'New notification available'),
    source: String(payload.source || 'web-app'),
    metadata: payload.metadata || {},
  };

  if (!shouldStoreAlert(alertInput)) {
    return res.status(202).json({ message: 'Skipped duplicate notification in cooldown window.' });
  }

  const alert = await addAlert(alertInput);
  return res.status(201).json({ message: 'Notification stored.', alert });
});

router.patch('/:id/read', validateRequest({ params: idParamsSchema }), async (req, res) => {
  const userId = String(req.auth?.user?.id || req.headers['x-user-id'] || 'anonymous');
  const alert = await markAlertRead(req.params.id, userId);
  if (!alert) {
    return res.status(404).json({ message: 'Notification not found.' });
  }

  return res.json({ message: 'Notification marked as read.', alert });
});

router.delete('/:id', validateRequest({ params: idParamsSchema }), async (req, res) => {
  const userId = String(req.auth?.user?.id || req.headers['x-user-id'] || 'anonymous');
  const alert = await deleteAlert(req.params.id, userId);
  if (!alert) {
    return res.status(404).json({ message: 'Notification not found.' });
  }

  return res.json({ message: 'Notification deleted successfully.', alert });
});

router.post('/schedule/tick', async (_req, res) => {
  try {
    await runAlertSchedulerNow();
    return res.json({ message: 'Scheduler tick completed.' });
  } catch {
    return res.status(500).json({ message: 'Scheduler tick failed.' });
  }
});

router.get('/debug', async (_req, res) => {
  const scheduler = getSchedulerDebugState();
  const store = await getAlertsDebugState();
  return res.json({ scheduler, store });
});

export const alertsRouter = router;
