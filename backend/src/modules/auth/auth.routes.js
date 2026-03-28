import { Router } from 'express';
import { z } from 'zod';
import { createAdmin, getUserById, touchLastLogin, updateAdminProfile, verifyAdminCredentials } from './auth.store.js';
import { issueAccessToken, issueOtpChallengeToken, verifyToken } from './token.service.js';
import { createOtpChallenge } from '../otp/otp.store.js';
import { isEmailTransportConfigured, sendAccountChangeAlert, sendOTPEmail } from '../notifications/mailer.service.js';
import { addAlert } from '../alerts/alerts.store.js';
import { requireAuth, requireAdmin } from './auth.middleware.js';
import { listFeatureFlags } from '../admin/feature.store.js';
import { AppError } from '../../lib/errors.js';
import { loginFarmerByPhone, registerFarmer } from '../farmer/farmer.service.js';
import { updateProfile } from '../profile/profile.store.js';
import { validateRequest } from '../../lib/validate.js';

const router = Router();

const farmerRegisterSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(25),
}).strict();

const farmerLoginSchema = z.object({
  phone: z.string().trim().min(7).max(25),
}).strict();

const adminRegisterSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  password: z.string().min(8).max(120),
}).strict();

const adminLoginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(120),
}).strict();

const adminProfileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().optional(),
  password: z.string().min(8).max(120).optional(),
  otpProofToken: z.string().trim().min(16).optional(),
}).strict();

async function buildSession(user) {
  return {
    token: issueAccessToken(user),
    user,
    features: await listFeatureFlags(),
  };
}

function readActionProof(req, expectedPurpose) {
  const token = req.body?.otpProofToken || req.headers['x-otp-proof'];
  if (!token || typeof token !== 'string') {
    throw new AppError(403, 'OTP verification is required for this action.');
  }

  const payload = verifyToken(token);
  if (payload.type !== 'action_proof' || payload.purpose !== expectedPurpose) {
    throw new AppError(403, 'OTP proof is invalid or expired.');
  }

  return payload;
}

router.post('/farmer/register', validateRequest({ body: farmerRegisterSchema }), async (req, res) => {
  const user = await registerFarmer(req.body || {});
  await updateProfile(user.id, {
    name: user.name,
    phone: user.phone,
    role: 'farmer',
  }, user);
  await addAlert({
    userId: user.id,
    type: 'system',
    level: 'low',
    title: 'Registration successful',
    message: 'Welcome to Smart Agriculture. Your farmer account is ready.',
    source: 'farmer-register',
    metadata: {},
  });

  res.status(201).json(await buildSession(user));
});

router.post('/farmer/login', validateRequest({ body: farmerLoginSchema }), async (req, res) => {
  const farmer = await loginFarmerByPhone(req.body?.phone);
  const user = await touchLastLogin(farmer.id);
  await updateProfile(user.id, {
    name: user.name,
    phone: user.phone,
    role: 'farmer',
  }, user);
  await addAlert({
    userId: user.id,
    type: 'system',
    level: 'low',
    title: 'Login successful',
    message: 'You signed in to Smart Agriculture successfully.',
    source: 'farmer-login',
    metadata: {},
  });

  res.json(await buildSession(user));
});

router.post('/admin/register', validateRequest({ body: adminRegisterSchema }), async (req, res) => {
  const user = await createAdmin(req.body || {});
  const otp = await createOtpChallenge(user.id, 'admin_register');
  const delivery = await sendOTPEmail(user.email, otp);

  res.status(202).json({
    message: 'OTP sent to admin email for signup verification.',
    otpSessionToken: issueOtpChallengeToken(user.id, 'admin_register'),
    ...(!isEmailTransportConfigured() || !delivery.delivered ? { debugOtp: otp } : {}),
  });
});

router.post('/admin/login', validateRequest({ body: adminLoginSchema }), async (req, res) => {
  const user = await verifyAdminCredentials(req.body?.email, req.body?.password);
  const otp = await createOtpChallenge(user.id, 'admin_login');
  const delivery = await sendOTPEmail(user.email, otp);

  res.status(202).json({
    message: 'OTP sent to admin email for login verification.',
    otpSessionToken: issueOtpChallengeToken(user.id, 'admin_login'),
    ...(!isEmailTransportConfigured() || !delivery.delivered ? { debugOtp: otp } : {}),
  });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await getUserById(req.auth.user.id);
  res.json({
    user,
    features: await listFeatureFlags(),
  });
});

router.post('/logout', requireAuth, (_req, res) => {
  res.json({ message: 'Logged out successfully.' });
});

router.patch('/admin/profile', requireAuth, requireAdmin, validateRequest({ body: adminProfileUpdateSchema }), async (req, res) => {
  const proof = readActionProof(req, 'admin_profile_update');
  if (proof.sub !== req.auth.user.id) {
    throw new AppError(403, 'OTP proof does not belong to the signed-in admin.');
  }

  const user = await updateAdminProfile(req.auth.user.id, req.body || {});
  await sendAccountChangeAlert(user.email, 'profile details were updated');
  await addAlert({
    userId: user.id,
    type: 'system',
    level: 'medium',
    title: 'Profile updated',
    message: 'Your admin profile was updated successfully.',
    source: 'admin-profile-update',
    metadata: {},
  });

  res.json({ message: 'Admin profile updated.', user });
});

export const authRouter = router;
