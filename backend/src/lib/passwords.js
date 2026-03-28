import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

function deriveHash(password, salt) {
  return scryptSync(password, salt, 64).toString('hex');
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = deriveHash(password, salt);
  return { salt, hash };
}

export function verifyPassword(password, salt, expectedHash) {
  const actual = deriveHash(password, salt);
  return timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expectedHash, 'hex'));
}
