import { randomInt } from 'node:crypto';
import { fetchOne, query } from '../../db/mysql.js';
import { AppError, isDatabaseUnavailableError } from '../../lib/errors.js';
import { createOtpChallengeLocal, verifyOtpChallengeLocal } from '../../lib/local-store.js';

const OTP_EXPIRY_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 3;

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

export async function verifyOtpChallenge(userId, purpose, otp) {
  return withLocalFallback(
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
}
