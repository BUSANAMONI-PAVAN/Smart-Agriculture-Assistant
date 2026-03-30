import jwt from 'jsonwebtoken';

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
  return jwt.verify(token, JWT_SECRET);
}
