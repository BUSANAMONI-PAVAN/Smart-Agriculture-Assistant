import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/modules/farmer/farmer.service.js', () => ({
  registerFarmer: vi.fn(async () => ({
    id: 'farmer-1',
    name: 'Farmer One',
    email: '',
    phone: '9999999999',
    role: 'farmer',
    status: 'active',
  })),
  loginFarmerByPhone: vi.fn(async () => ({
    id: 'farmer-1',
    name: 'Farmer One',
    email: '',
    phone: '9999999999',
    role: 'farmer',
    status: 'active',
  })),
}));

vi.mock('../src/modules/auth/auth.store.js', () => ({
  createAdmin: vi.fn(async () => ({ id: 'admin-1', email: 'admin@example.com', role: 'admin', name: 'Admin' })),
  getUserById: vi.fn(async () => ({ id: 'admin-1', email: 'admin@example.com', role: 'admin', name: 'Admin', status: 'active' })),
  touchLastLogin: vi.fn(async () => ({ id: 'admin-1', email: 'admin@example.com', role: 'admin', name: 'Admin', status: 'active' })),
  verifyAdminCredentials: vi.fn(async () => ({ id: 'admin-1', email: 'admin@example.com', role: 'admin', name: 'Admin', status: 'active' })),
  updateAdminProfile: vi.fn(async () => ({ id: 'admin-1', email: 'admin@example.com', role: 'admin', name: 'Admin', status: 'active' })),
  getUserRecordById: vi.fn(async () => ({ id: 'admin-1', email: 'admin@example.com', role: 'admin', name: 'Admin', status: 'active' })),
  activateAdmin: vi.fn(async () => ({ id: 'admin-1', role: 'admin', status: 'active' })),
  listUsers: vi.fn(async () => []),
  createManagedUser: vi.fn(async () => ({ id: 'u-1', role: 'farmer', name: 'User A', email: '', phone: '9999999999' })),
  updateUserByAdmin: vi.fn(async () => ({ id: 'u-1', role: 'farmer', name: 'User A', email: '', phone: '9999999999', status: 'active' })),
  deleteUserByAdmin: vi.fn(async () => ({ id: 'u-1', role: 'farmer', name: 'User A', email: '', phone: '9999999999' })),
}));

vi.mock('../src/modules/auth/token.service.js', () => ({
  issueAccessToken: vi.fn(() => 'access-token'),
  issueOtpChallengeToken: vi.fn(() => 'otp-session-token'),
  issueActionProofToken: vi.fn(() => 'otp-proof-token'),
  verifyToken: vi.fn(() => ({ type: 'action_proof', purpose: 'system_control', sub: 'admin-1' })),
}));

vi.mock('../src/modules/otp/otp.store.js', () => ({
  createOtpChallenge: vi.fn(async () => '123456'),
  verifyOtpChallenge: vi.fn(async () => true),
}));

vi.mock('../src/modules/admin/feature.store.js', () => ({
  listFeatureFlags: vi.fn(async () => []),
  updateFeatureFlags: vi.fn(async () => []),
}));

vi.mock('../src/modules/alerts/alerts.store.js', () => ({
  addAlert: vi.fn(async () => ({ id: 'alert-1' })),
  getAlerts: vi.fn(async () => []),
  deleteAlert: vi.fn(async () => ({
    id: 'alert-1',
    userId: 'u-1',
    type: 'system',
    level: 'low',
    source: 'test',
  })),
  shouldStoreAlert: vi.fn(() => true),
}));

vi.mock('../src/modules/admin/audit.store.js', () => ({
  appendAuditLog: vi.fn(async () => {}),
  listAuditLogs: vi.fn(async () => []),
}));

vi.mock('../src/modules/notifications/mailer.service.js', () => ({
  isEmailTransportConfigured: vi.fn(() => false),
  sendOTPEmail: vi.fn(async () => ({})),
  sendAccountChangeAlert: vi.fn(async () => ({})),
  sendSystemEmail: vi.fn(async () => ({})),
}));

vi.mock('../src/modules/ai/gemini.service.js', () => ({
  generateGeminiFarmingAnswer: vi.fn(async () => ({
    answer: 'Fallback answer',
    model: 'local-fallback',
    provider: 'rules',
    quotaExceeded: true,
  })),
}));

vi.mock('../src/modules/ai/chat.store.js', () => ({
  saveChatTurn: vi.fn(async () => ({ id: 'chat-1' })),
  getChatHistory: vi.fn(async () => []),
}));

vi.mock('../src/modules/profile/profile.store.js', () => ({
  getProfile: vi.fn(async () => ({
    latitude: 17.385,
    longitude: 78.4867,
    crops: ['rice'],
  })),
}));

vi.mock('../src/modules/weather/weather.provider.js', () => ({
  fetchWeatherSummary: vi.fn(async () => null),
}));

const { authRouter } = await import('../src/modules/auth/auth.routes.js');
const { otpRouter } = await import('../src/modules/otp/otp.routes.js');
const { aiRouter } = await import('../src/modules/ai/ai.routes.js');
const { adminRouter } = await import('../src/modules/admin/admin.routes.js');
const { requireAdmin } = await import('../src/modules/auth/auth.middleware.js');

function createApp(router, withAdmin = false) {
  const app = express();
  app.use(express.json());
  if (withAdmin) {
    app.use((req, _res, next) => {
      req.auth = {
        user: {
          id: 'admin-1',
          role: 'admin',
          email: 'admin@example.com',
          name: 'Admin',
          status: 'active',
          adminEnabled: true,
        },
      };
      next();
    });
  }
  app.use(router);
  app.use((error, _req, res, _next) => {
    res.status(error.status || 500).json({ message: error.message, detail: error.detail || null });
  });
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Auth Route Validation', () => {
  it('rejects invalid farmer registration payload', async () => {
    const app = createApp(authRouter);
    const response = await request(app).post('/farmer/register').send({ name: 'A' });
    expect(response.status).toBe(400);
    expect(response.body.message).toContain('validation');
  });
});

describe('OTP Route Validation', () => {
  it('rejects invalid OTP format before business logic', async () => {
    const app = createApp(otpRouter);
    const response = await request(app)
      .post('/admin/verify')
      .send({ otpSessionToken: 'session-token-1234567890', otp: '123' });
    expect(response.status).toBe(400);
  });
});

describe('Admin Permission Middleware', () => {
  it('returns 403 for non-admin users', async () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.auth = { user: { id: 'u-1', role: 'farmer' } };
      next();
    });
    app.get('/secure', requireAdmin, (_req, res) => res.json({ ok: true }));

    const response = await request(app).get('/secure');
    expect(response.status).toBe(403);
  });
});

describe('AI Ask Route', () => {
  it('returns fallback metadata for AI ask response', async () => {
    const app = createApp(aiRouter, true);
    const response = await request(app).post('/ask').send({ query: 'What should I do for rain today?' });
    expect(response.status).toBe(200);
    expect(response.body.provider).toBe('rules');
    expect(response.body.quotaExceeded).toBe(true);
  });
});

describe('Notification Delete Security', () => {
  it('requires OTP proof for deleting a notification', async () => {
    const app = createApp(adminRouter, true);
    const withoutOtp = await request(app).delete('/notifications/alert-1').send({});
    expect(withoutOtp.status).toBe(400);

    const withOtp = await request(app)
      .delete('/notifications/alert-1')
      .send({ otpProofToken: 'proof-token-1234567890' });
    expect(withOtp.status).toBe(200);
  });
});

