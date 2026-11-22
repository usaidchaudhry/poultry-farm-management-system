import mongoose from 'mongoose';
import { Organization } from '../access/models.js';
import { entity, scopeFilter } from '../organization/service.js';
import { allowedDateRange, businessDate } from '../../policies/dates.js';
import { AppError } from '../../lib/errors.js';
export function mongoIds(value) {
  if (typeof value === 'string' && /^[a-f\d]{24}$/i.test(value)) return new mongoose.Types.ObjectId(value);
  if (Array.isArray(value)) return value.map(mongoIds);
  if (value && Object.getPrototypeOf(value) === Object.prototype) return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, mongoIds(v)]));
  return value;
}
export async function context(actor, query, { clinical = false, farmOnly = false, current = false } = {}) {
  if (farmOnly && (query.houseId || query.flockId)) throw new AppError(422, 'FARM_REPORT_FILTER', 'This source is recorded by farm; choose a site or farm without a house/flock filter.');
  const org = await Organization.findById(actor.organizationId);
  // Validate even current-state queries: explicit forbidden ranges are never ignored.
  const range = allowedDateRange(actor, { from: query.from, to: query.to, clinical, timezone: org.timezone });
  const scope = await scopeFilter(actor, 'flock');
  for (const kind of ['site', 'farm', 'house', 'flock']) if (query[`${kind}Id`]) {
    const record = await entity(actor, kind, query[`${kind}Id`]);
    for (const parent of ['site', 'farm', 'house']) if (query[`${parent}Id`] && record[`${parent}Id`] && String(record[`${parent}Id`]) !== query[`${parent}Id`]) throw new AppError(422, 'ANCESTRY_MISMATCH', 'These hierarchy filters do not belong together.');
    scope[`${kind}Id`] = record._id;
  }
  return { scope: mongoIds(scope), filter: mongoIds({ ...scope, ...(!current ? { businessDate: { $gte: range.from, $lte: range.to } } : {}) }), meta: { ...range, today: businessDate(new Date(), org.timezone), timezone: org.timezone, currency: org.currency } };
}
export function jsonValues(value) {
  if (value?._bsontype === 'Decimal128' || value?._bsontype === 'ObjectId') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(jsonValues);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, jsonValues(v)]));
  return value;
}
