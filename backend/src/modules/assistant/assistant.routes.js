import { Router } from 'express';
import { z } from 'zod';
import { getDigitalTwin } from '../digitalTwin/digitalTwin.store.js';
import { computeLifecycleSnapshot } from '../lifecycle/lifecycle.store.js';
import { saveAssistantTurn, getAssistantHistory } from './assistant.store.js';
import { validateRequest } from '../../lib/validate.js';

const router = Router();

const queryBodySchema = z.object({
  message: z.string().trim().min(3).max(2000),
}).strict();

function uid(req) {
  return String(req.headers['x-user-id'] || req.query.userId || 'anonymous');
}

function answerWithContext(question, context) {
  const q = String(question || '').toLowerCase();
  const crop = context.primaryCrop;

  if (q.includes('today') || q.includes('ఏం చేయాలి')) {
    return {
      answer: `Today focus on ${crop}: ${context.stageTask}. Keep field moisture monitored and avoid unnecessary spray during peak heat.`,
      confidence: 0.88,
      reasoning: 'Combined crop lifecycle stage and land profile context.',
    };
  }

  if (q.includes('water') || q.includes('irrigation') || q.includes('నీరు')) {
    return {
      answer: `For ${crop}, use split irrigation based on root-zone moisture. Soil type is ${context.soilType}, so avoid waterlogging and check moisture before each cycle.`,
      confidence: 0.85,
      reasoning: 'Used digital twin soil type and crop stage task list.',
    };
  }

  if (q.includes('profit') || q.includes('market') || q.includes('ధర')) {
    return {
      answer: `Track daily mandi trend for ${crop}. Sell in batches and avoid distress sale on oversupply days. Use Market Intelligence page for best-market recommendation.`,
      confidence: 0.8,
      reasoning: 'Routed user intent to market intelligence with crop context.',
    };
  }

  return {
    answer: `Based on your farm profile, prioritize ${crop} stage actions, weather alerts, and weekly disease scouting. Open Lifecycle and Weather modules for exact task list.`,
    confidence: 0.78,
    reasoning: 'Default assistant policy response with profile context.',
  };
}

router.post('/query', validateRequest({ body: queryBodySchema }), (req, res) => {
  const userId = uid(req);
  const question = String(req.body?.message || '');
  if (!question.trim()) {
    return res.status(400).json({ message: 'message is required' });
  }

  const twin = getDigitalTwin(userId);
  const lifecycle = computeLifecycleSnapshot(userId);
  const primaryCycle = lifecycle.cycles[0];

  const result = answerWithContext(question, {
    soilType: twin.landProfile.soilType,
    primaryCrop: primaryCycle?.crop || twin.cropHistory[0]?.crop || 'your crop',
    stageTask: primaryCycle?.tasks?.[0] || 'follow weekly crop schedule',
  });

  const payload = {
    question,
    answer: result.answer,
    confidence: result.confidence,
    reasoning: result.reasoning,
    dataSources: ['digital-twin', 'lifecycle-engine', 'rules-assistant'],
    generatedAt: new Date().toISOString(),
  };

  saveAssistantTurn(userId, payload);
  return res.json(payload);
});

router.get('/history', (req, res) => {
  res.json({ history: getAssistantHistory(uid(req)) });
});

export const assistantRouter = router;
