import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pino from 'pino';
import pinoHttp from 'pino-http';

import { authRouter } from './modules/auth/auth.routes.js';
import { attachRequestAuth, requireAdmin, requireAuth } from './modules/auth/auth.middleware.js';
import { otpRouter } from './modules/otp/otp.routes.js';
import { profileRouter } from './modules/profile/profile.routes.js';
import { weatherRouter } from './modules/weather/weather.routes.js';
import { cropRouter } from './modules/crops/crops.routes.js';
import { diseaseRouter } from './modules/disease/disease.routes.js';
import { marketRouter } from './modules/market/market.routes.js';
import { schemesRouter } from './modules/schemes/schemes.routes.js';
import { alertsRouter } from './modules/alerts/alerts.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { digitalTwinRouter } from './modules/digitalTwin/digitalTwin.routes.js';
import { lifecycleRouter } from './modules/lifecycle/lifecycle.routes.js';
import { assistantRouter } from './modules/assistant/assistant.routes.js';
import { aiRouter } from './modules/ai/ai.routes.js';
import { dataRouter } from './modules/data/data.routes.js';
import { riskRouter } from './modules/risk/risk.routes.js';
import { marketplaceRouter } from './modules/marketplace/marketplace.routes.js';
import { communityRouter } from './modules/community/community.routes.js';
import { iotRouter } from './modules/iot/iot.routes.js';
import { transparencyRouter } from './modules/transparency/transparency.routes.js';
import { isAppError } from './lib/errors.js';
import { getMetricsSnapshot, observeHttpRequest } from './lib/metrics.js';
import { getDatabaseHealth } from './db/state.js';

const app = express();
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: {
    service: 'smart-agriculture-api',
    env: process.env.NODE_ENV || 'development',
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || 80),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many authentication requests. Please retry later.' },
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.OTP_RATE_LIMIT_MAX || 50),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many OTP requests. Please retry later.' },
});

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AI_RATE_LIMIT_MAX || 80),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'AI request limit reached. Please retry shortly.' },
});

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(
  pinoHttp({
    logger,
    autoLogging: true,
    serializers: {
      req(request) {
        return {
          method: request.method,
          url: request.url,
          id: request.id,
        };
      },
      res(response) {
        return {
          statusCode: response.statusCode,
        };
      },
    },
  }),
);
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;
    observeHttpRequest({
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs,
    });
  });
  next();
});

function buildHealthPayload() {
  const database = getDatabaseHealth();

  return {
    ok: true,
    status: database.ready ? 'ok' : 'degraded',
    service: 'smart-agriculture-api',
    database,
  };
}

app.get('/', (_req, res) => {
  res.json(buildHealthPayload());
});

app.get('/api/v1/health', (_req, res) => {
  res.json(buildHealthPayload());
});

app.use('/api/v1', attachRequestAuth);
app.use('/api/v1/auth', authLimiter);
app.use('/api/v1/otp', otpLimiter);
app.use('/api/v1/ai', aiLimiter);
app.use('/api/ai', aiLimiter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/otp', otpRouter);
app.use('/api/v1/profile', requireAuth, profileRouter);
app.use('/api/v1/weather', requireAuth, weatherRouter);
app.use('/api/v1/crops', requireAuth, cropRouter);
app.use('/api/v1/disease', requireAuth, diseaseRouter);
app.use('/api/v1/market', requireAuth, marketRouter);
app.use('/api/v1/schemes', requireAuth, schemesRouter);
app.use('/api/v1/alerts', requireAuth, alertsRouter);
app.use('/api/v1/admin', requireAuth, requireAdmin, adminRouter);
app.use('/api/v1/digital-twin', requireAuth, digitalTwinRouter);
app.use('/api/v1/lifecycle', requireAuth, lifecycleRouter);
app.use('/api/v1/assistant', requireAuth, assistantRouter);
app.use('/api/v1/ai', requireAuth, aiRouter);
app.use('/api/v1/data', requireAuth, dataRouter);
app.use('/api/v1/risk', requireAuth, riskRouter);
app.use('/api/v1/marketplace', requireAuth, marketplaceRouter);
app.use('/api/v1/community', requireAuth, communityRouter);
app.use('/api/v1/iot', requireAuth, iotRouter);
app.use('/api/v1/transparency', requireAuth, transparencyRouter);
app.use('/api/ai', attachRequestAuth, requireAuth, aiRouter);
app.get('/api/v1/metrics', requireAuth, requireAdmin, (_req, res) => {
  res.json(getMetricsSnapshot());
});

app.use((error, req, res, _next) => {
  if (req.log) {
    req.log.error(
      {
        err: error,
        path: req.path,
        method: req.method,
      },
      'request_failed',
    );
  }

  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Invalid JSON payload.' });
  }

  if (isAppError(error)) {
    return res.status(error.status).json({ message: error.message, detail: error.detail || null });
  }

  return res.status(500).json({ message: 'Internal server error', detail: error?.message || 'Unknown error' });
});

export default app;
