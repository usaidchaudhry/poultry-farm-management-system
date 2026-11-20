import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
const options = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64, options);
  return `scrypt$${options.N}$${options.r}$${options.p}$${salt}$${hash.toString('hex')}`;
}

export async function verifyPassword(password, encoded) {
  if (typeof encoded !== 'string') return false;
  const [algorithm, n, r, p, salt, hash] = encoded.split('$');
  // The stored work factor makes future upgrades possible without silently
  // changing how existing passwords are verified. Bound stored parameters.
  if (algorithm !== 'scrypt' || !['16384', '32768'].includes(n) || r !== '8' || p !== '1' || !/^[a-f0-9]{32}$/.test(salt || '') || !/^[a-f0-9]{128}$/.test(hash || '')) return false;
  const actual = await scrypt(password, salt, 64, { ...options, N: Number(n) });
  return timingSafeEqual(actual, Buffer.from(hash, 'hex'));
}

// Used only to equalize unknown-account verification work; this is not an account credential.
export const dummyHash = await hashPassword(randomBytes(32).toString('hex'));
