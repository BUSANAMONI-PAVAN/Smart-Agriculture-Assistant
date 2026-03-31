import jwt from 'jsonwebtoken';
import { AppError } from '../../lib/errors.js';

const JWT_SECRET = process.env.JWT_SECRET || 'smart-agriculture-local-secret';

export function issueAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      type: 'access',
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: '7d' },
  );
}

export function issueOtpChallengeToken(userId, purpose, metadata = {}) {
  const payload = {
    sub: userId,
    type: 'otp_challenge',
    purpose,
  };

  if (typeof metadata.otpHash === 'string' && metadata.otpHash.trim()) {
    payload.otpHash = metadata.otpHash.trim();
  }

  return jwt.sign(
    payload,
    JWT_SECRET,
    { expiresIn: '10m' },
  );
}

export function issueActionProofToken(userId, purpose) {
  return jwt.sign(
    {
      sub: userId,
      type: 'action_proof',
      purpose,
    },
    JWT_SECRET,
    { expiresIn: '10m' },
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    const name = String(error?.name || '');
    if (name === 'TokenExpiredError') {
      throw new AppError(401, 'Token expired. Please request a new token.');
    }
    if (name === 'JsonWebTokenError' || name === 'NotBeforeError') {
      throw new AppError(401, 'Invalid token.');
    }
    throw error;
  }
}
