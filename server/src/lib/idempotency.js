import { createHash } from 'node:crypto';
import { transaction } from '../config/database.js';
import { AppError } from './errors.js';
import { IdempotencyRecord } from '../modules/access/models.js';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

// For later source-linked business modules. Work must use the supplied session
// for every write and must not send mail, write files, or call external APIs.
export async function idempotentWrite({ actorId, operation, key, payload }, work) {
  if (!/^[\w-]{16,100}$/.test(key || '')) throw new AppError(422, 'IDEMPOTENCY_REQUIRED', 'Supply a 16–100 character Idempotency-Key.');
  const fingerprint = createHash('sha256').update(JSON.stringify(canonical(payload))).digest('hex');
  const filter = { actorId, operation, key };
  const replay = (record) => {
    if (record.fingerprint !== fingerprint) throw new AppError(409, 'IDEMPOTENCY_CONFLICT', 'This key was already used with different inputs.');
    return record.result;
  };
  try {
    return await transaction(async (session) => {
      const existing = await IdempotencyRecord.findOne(filter).session(session);
      if (existing) return replay(existing);
      const result = await work(session);
      await IdempotencyRecord.create([{ ...filter, fingerprint, result, expiresAt: new Date(Date.now() + 86_400_000) }], { session });
      return result;
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    const existing = await IdempotencyRecord.findOne(filter);
    if (!existing) throw error;
    return replay(existing);
  }
}
