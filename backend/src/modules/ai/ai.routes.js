import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../../lib/errors.js';
import { fetchWeatherSummary } from '../weather/weather.provider.js';
import { generateGeminiFarmingAnswer } from './gemini.service.js';
import { saveChatTurn, getChatHistory } from './chat.store.js';
import { addAlert, shouldStoreAlert } from '../alerts/alerts.store.js';
import { sendSystemEmail } from '../notifications/mailer.service.js';
import { getProfile } from '../profile/profile.store.js';
import { validateRequest } from '../../lib/validate.js';

const router = Router();

const askBodySchema = z.object({
  query: z.string().trim().min(3).max(2500).optional(),
  message: z.string().trim().min(3).max(2500).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  crop: z.string().trim().min(1).max(80).optional(),
}).strict().superRefine((value, ctx) => {
  if (!value.query && !value.message) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['query'], message: 'query or message is required.' });
  }
});

const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function classifyAlertLevel(answer, weatherSummary) {
  const text = String(answer || '').toLowerCase();
  if (
    text.includes('urgent')
    || text.includes('immediate')
    || text.includes('high risk')
    || (weatherSummary?.rainChance24h || 0) >= 80
    || (weatherSummary?.tempC || 0) >= 40
  ) {
    return 'high';
  }
  if (
    text.includes('watch')
    || text.includes('monitor')
    || text.includes('medium')
    || (weatherSummary?.rainChance24h || 0) >= 50
  ) {
    return 'medium';
  }
  return 'low';
}

function deriveTitle(level) {
  if (level === 'high') return 'Important AI field alert';
  if (level === 'medium') return 'AI farming recommendation';
  return 'AI assistant update';
}

router.post('/ask', validateRequest({ body: askBodySchema }), async (req, res) => {
  const message = String(req.body?.query || req.body?.message || '').trim();
  if (!message) {
    throw new AppError(400, 'Query is required.');
  }
  if (message.length < 3) {
    throw new AppError(400, 'Query is too short.');
  }
  if (message.length > 2500) {
    throw new AppError(400, 'Query is too long.');
  }

  const profile = await getProfile(req.auth.user.id, req.auth.user);
  const latitude = toNumber(req.body?.lat) ?? toNumber(profile.latitude);
  const longitude = toNumber(req.body?.lng) ?? toNumber(profile.longitude);
  const crop = String(req.body?.crop || profile?.crops?.[0] || '').trim();

  let weatherSummary = null;
  if (latitude !== null && longitude !== null) {
    try {
      weatherSummary = await fetchWeatherSummary(latitude, longitude);
    } catch {
      weatherSummary = null;
    }
  }

  const ai = await generateGeminiFarmingAnswer({
    query: message,
    user: req.auth.user,
    weatherSummary,
    crop,
  });

  const level = classifyAlertLevel(ai.answer, weatherSummary);
  const title = deriveTitle(level);
  const compactAnswer = ai.answer.replace(/\s+/g, ' ').slice(0, 300);

  const alertPayload = {
    userId: req.auth.user.id,
    type: 'system',
    level,
    title,
    message: compactAnswer,
    source: 'ai-assistant',
    metadata: {
      fingerprint: `ai:${req.auth.user.id}:${new Date().toISOString().slice(0, 13)}:${level}`,
      model: ai.model,
      provider: ai.provider,
    },
  };

  if (shouldStoreAlert(alertPayload)) {
    await addAlert(alertPayload);
  }

  if (req.auth.user.role === 'admin' && req.auth.user.email && level === 'high') {
    await sendSystemEmail({
      email: req.auth.user.email,
      subject: 'Smart Agriculture important AI alert',
      title,
      message: compactAnswer,
    });
  }

  const entry = await saveChatTurn({
    userId: req.auth.user.id,
    question: message,
    answer: ai.answer,
    model: ai.model,
    weatherSummary,
    metadata: {
      role: req.auth.user.role,
      provider: ai.provider,
      crop,
      level,
      quotaExceeded: Boolean(ai.quotaExceeded),
      detail: ai.detail || null,
    },
  });

  return res.json({
    id: entry?.id || null,
    answer: ai.answer,
    model: ai.model,
    provider: ai.provider,
    level,
    quotaExceeded: Boolean(ai.quotaExceeded),
    weatherSummary,
    generatedAt: new Date().toISOString(),
  });
});

router.get('/history', validateRequest({ query: historyQuerySchema }), async (req, res) => {
  const limit = Number(req.query.limit || 40);
  const history = await getChatHistory(req.auth.user.id, limit);
  return res.json({ history });
});

export const aiRouter = router;
