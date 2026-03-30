import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { fetchOne, query } from '../../db/mysql.js';
import { AppError, isAppError, isDatabaseUnavailableError } from '../../lib/errors.js';
import { createOtpChallengeLocal, verifyOtpChallengeLocal } from '../../lib/local-store.js';

const OTP_EXPIRY_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 3;
const OTP_TOKEN_SECRET = String(process.env.OTP_TOKEN_SECRET || process.env.JWT_SECRET || 'smart-agriculture-local-secret');

function generateOtp() {
  return String(randomInt(100000, 999999));
}

async function withLocalFallback(action, fallback) {
  try {
    return await action();
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return fallback();
    }
    throw error;
  }
}

function safeText(value) {
  return String(value || '').trim();
}

function buildOtpHash(userId, purpose, otp) {
  return createHash('sha256')
    .update(`${OTP_TOKEN_SECRET}:${safeText(userId)}:${safeText(purpose)}:${safeText(otp)}`)
    .digest('hex');
}

function safeEqualHex(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'hex');
  const rightBuffer = Buffer.from(String(right || ''), 'hex');
  if (leftBuffer.length === 0 || rightBuffer.length === 0 || leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function createOtpTokenHash(userId, purpose, otp) {
  return buildOtpHash(userId, purpose, otp);
}

function canVerifyFromChallenge(challenge) {
  return Boolean(challenge && typeof challenge.otpHash === 'string' && challenge.otpHash.trim());
}

function verifyFromChallenge(userId, purpose, otp, challenge) {
  if (!canVerifyFromChallenge(challenge)) {
    throw new AppError(404, 'OTP request not found. Please request a new OTP.');
  }

  const expectedHash = safeText(challenge.otpHash);
  const providedHash = buildOtpHash(userId, purpose, otp);
  if (!safeEqualHex(expectedHash, providedHash)) {
    throw new AppError(401, 'Invalid OTP.');
  }

  return true;
}

export async function createOtpChallenge(userId, purpose) {
  const otp = generateOtp();

  return withLocalFallback(
    async () => {
      await query(
        `
          UPDATE otp_codes
          SET consumed_at = NOW()
          WHERE user_id = ? AND purpose = ? AND consumed_at IS NULL
        `,
        [userId, purpose],
      );

      await query(
        `
          INSERT INTO otp_codes (user_id, otp_code, purpose, expires_at, attempts, max_attempts)
          VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), 0, ?)
        `,
        [userId, otp, purpose, OTP_EXPIRY_MINUTES, OTP_MAX_ATTEMPTS],
      );

      return otp;
    },
    () => {
      createOtpChallengeLocal(userId, purpose, otp, OTP_EXPIRY_MINUTES, OTP_MAX_ATTEMPTS);
      return otp;
    },
  );
}

export async function verifyOtpChallenge(userId, purpose, otp, challenge = null) {
  try {
    return await withLocalFallback(
      async () => {
        const record = await fetchOne(
          `
            SELECT *
            FROM otp_codes
            WHERE user_id = ?
              AND purpose = ?
              AND consumed_at IS NULL
            ORDER BY created_at DESC
            LIMIT 1
          `,
          [userId, purpose],
        );

        if (!record) {
          throw new AppError(404, 'OTP request not found. Please request a new OTP.');
        }

        if (new Date(record.expires_at).getTime() < Date.now()) {
          throw new AppError(410, 'OTP expired. Please request a new OTP.');
        }

        if (record.attempts >= record.max_attempts) {
          throw new AppError(429, 'Maximum OTP attempts reached. Please resend OTP.');
        }

        if (String(record.otp_code) !== String(otp || '')) {
          await query('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?', [record.id]);
          throw new AppError(401, 'Invalid OTP.');
        }

        await query('UPDATE otp_codes SET consumed_at = NOW() WHERE id = ?', [record.id]);
        return true;
      },
      () => verifyOtpChallengeLocal(userId, purpose, otp),
    );
  } catch (error) {
    if (canVerifyFromChallenge(challenge)) {
      if (isAppError(error) && [404, 503].includes(error.status)) {
        return verifyFromChallenge(userId, purpose, otp, challenge);
      }
      if (isDatabaseUnavailableError(error)) {
        return verifyFromChallenge(userId, purpose, otp, challenge);
      }
    }
    throw error;
  }
}
