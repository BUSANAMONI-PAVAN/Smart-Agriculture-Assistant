import { Router } from 'express';
import { z } from 'zod';
import { getUserById, getUserRecordById, touchLastLogin } from '../auth/auth.store.js';
import { issueAccessToken, issueActionProofToken, issueOtpChallengeToken, verifyToken } from '../auth/token.service.js';
import { activateAdmin } from '../auth/auth.store.js';
import { createOtpChallenge, verifyOtpChallenge } from './otp.store.js';
import { addAlert } from '../alerts/alerts.store.js';
import { isEmailTransportConfigured, sendAccountChangeAlert, sendOTPEmail, sendSystemEmail } from '../notifications/mailer.service.js';
import { requireAuth, requireAdmin } from '../auth/auth.middleware.js';
import { AppError } from '../../lib/errors.js';
import { listFeatureFlags } from '../admin/feature.store.js';
import { validateRequest } from '../../lib/validate.js';

const router = Router();

const otpVerifySchema = z.object({
  otpSessionToken: z.string().trim().min(16),
  otp: z.string().trim().regex(/^\d{6}$/),
}).strict();

const otpResendSchema = z.object({
  otpSessionToken: z.string().trim().min(16),
}).strict();

const otpRequestSchema = z.object({
  purpose: z.string().trim().min(3).max(80).optional(),
}).strict();

function readChallengeToken(inputToken) {
  if (!inputToken || typeof inputToken !== 'string') {
    throw new AppError(400, 'OTP session token is required.');
  }

  const payload = verifyToken(inputToken);
  if (payload.type !== 'otp_challenge') {
    throw new AppError(400, 'Invalid OTP session token.');
  }
  return payload;
}

router.post('/admin/verify', validateRequest({ body: otpVerifySchema }), async (req, res) => {
  const challenge = readChallengeToken(req.body?.otpSessionToken);
  await verifyOtpChallenge(challenge.sub, challenge.purpose, req.body?.otp);

  if (challenge.purpose === 'admin_register') {
    await activateAdmin(challenge.sub);
  }

  if (challenge.purpose === 'admin_login') {
    await touchLastLogin(challenge.sub);
  }

  const user = await getUserById(challenge.sub);
  if (!user) {
    throw new AppError(404, 'Admin account not found.');
  }

  await addAlert({
    userId: user.id,
    type: 'system',
    level: 'medium',
    title: 'Admin verification successful',
    message: challenge.purpose === 'admin_register' ? 'Your admin signup was verified.' : 'Admin login verified successfully.',
    source: challenge.purpose,
    metadata: {},
  });

  if (challenge.purpose === 'admin_register' && user.email) {
    await sendSystemEmail({
      email: user.email,
      subject: 'Welcome to Smart Agriculture Admin',
      title: 'Registration successful',
      message: 'Your admin account has been verified and activated successfully.',
    });
  }

  if (challenge.purpose === 'admin_login') {
    await sendAccountChangeAlert(user.email, 'was used to sign in');
  }

  res.json({
    token: issueAccessToken(user),
    user,
    features: await listFeatureFlags(),
  });
});

router.post('/admin/resend', validateRequest({ body: otpResendSchema }), async (req, res) => {
  const challenge = readChallengeToken(req.body?.otpSessionToken);
  const user = await getUserRecordById(challenge.sub);
  if (!user || !user.email) {
    throw new AppError(404, 'Admin account not found.');
  }

  const otp = await createOtpChallenge(user.id, challenge.purpose);
  await sendOTPEmail(user.email, otp);

  res.json({
    message: 'OTP resent successfully.',
    otpSessionToken: issueOtpChallengeToken(user.id, challenge.purpose),
    ...(isEmailTransportConfigured() ? {} : { debugOtp: otp }),
  });
});

router.post('/admin/request', requireAuth, requireAdmin, validateRequest({ body: otpRequestSchema }), async (req, res) => {
  const purpose = String(req.body?.purpose || 'system_control');
  const user = await getUserRecordById(req.auth.user.id);
  if (!user?.email) {
    throw new AppError(400, 'Admin email is required for OTP delivery.');
  }

  const otp = await createOtpChallenge(user.id, purpose);
  await sendOTPEmail(user.email, otp);

  res.json({
    message: 'OTP sent for sensitive action verification.',
    otpSessionToken: issueOtpChallengeToken(user.id, purpose),
    ...(isEmailTransportConfigured() ? {} : { debugOtp: otp }),
  });
});

router.post('/admin/verify-action', requireAuth, requireAdmin, validateRequest({ body: otpVerifySchema }), async (req, res) => {
  const challenge = readChallengeToken(req.body?.otpSessionToken);
  if (challenge.sub !== req.auth.user.id) {
    throw new AppError(403, 'OTP challenge does not belong to this admin.');
  }

  await verifyOtpChallenge(challenge.sub, challenge.purpose, req.body?.otp);
  res.json({
    otpProofToken: issueActionProofToken(req.auth.user.id, challenge.purpose),
  });
});

export const otpRouter = router;
