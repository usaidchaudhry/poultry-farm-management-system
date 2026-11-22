import { z } from 'zod';
import { AppError } from './errors.js';

export const id = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid record ID.');
export const email = z.string().trim().toLowerCase().email().max(254);
export const password = z.string().min(12, 'Use at least 12 characters.').max(128, 'Use at most 128 characters.');
export const version = z.number().int().positive();
export const displayName = z.string().trim().min(2).max(100);

export function parse(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) {
    const errors = {};
    for (const issue of result.error.issues) errors[issue.path.join('.') || 'form'] = issue.message;
    throw new AppError(422, 'VALIDATION_ERROR', 'Check the highlighted fields.', errors);
  }
  return result.data;
}

export const body = (schema) => Object.assign((req, res, next) => { req.input = parse(schema, req.body); next(); }, { apiSchema: schema });
export const validId = (req, res, next) => { parse(id, req.params.id); next(); };
export function assertVersion(record, expected) {
  if (record.version !== expected) throw new AppError(409, 'VERSION_CONFLICT', 'This record changed. Refresh it before saving.');
}
export { z };
