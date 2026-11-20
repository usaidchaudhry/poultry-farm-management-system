import { z, id, version } from '../../lib/validation.js';
export const eggKeys = ['jumbo', 'starter', 'standard', 'small', 'floor', 'broken', 'discard'];
export const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, 'Use a valid calendar date.');
const text = z.string().trim().max(2000).default('');
const amount = z.number().min(0).max(10000000).nullable().default(null);
const count = z.number().int().min(0).max(10000000).nullable().default(null);
const treatment = z.object({ name: z.string().trim().min(1).max(150), quantity: amount, unit: z.string().trim().max(40).default(''), reference: z.string().trim().max(200).default(''), prescriptionId: id.nullable().default(null), administrationEventId: id.nullable().default(null) }).strict();
export const dataSchema = z.object({
  eggs: z.object(Object.fromEntries(eggKeys.map((key) => [key, count]))).strict().default(() => Object.fromEntries(eggKeys.map((key) => [key, null]))),
  eggSamples: z.array(z.object({ sampleType: z.enum(['single-egg', 'tray']), value: z.number().positive().max(10000000), unit: z.enum(['g', 'kg']) }).strict()).max(100).default([]),
  mortality: count,
  feed: z.object({ itemReference: z.string().trim().max(150).default(''), locationReference: z.string().trim().max(150).default(''), bags: amount, bagSizeKg: amount, additionalKg: amount, notes: text }).strict().default({ itemReference: '', locationReference: '', bags: null, bagSizeKg: null, additionalKg: null, notes: '' }),
  waterLitres: amount, lightHours: z.number().min(0).max(24).nullable().default(null),
  medicines: z.array(treatment).max(50).default([]), vaccines: z.array(treatment).max(50).default([]),
  measurementId: id.nullable().default(null), doctorVisitId: id.nullable().default(null), observations: text, postMortem: text, comments: text, issues: text, doctorVisitReference: z.string().trim().max(200).default(''), doctorRemarks: text, perPeNote: text,
}).strict();
export const createSchema = z.object({ flockId: id, businessDate: calendarDate, data: dataSchema, reason: text }).strict();
export const editSchema = z.object({ version, data: dataSchema, reason: text }).strict();
export const actionSchema = z.object({ version, reason: text }).strict();
export const listSchema = z.object({ from: calendarDate.optional(), to: calendarDate.optional(), flockId: id.optional(), houseId: id.optional(), farmId: id.optional(), siteId: id.optional(), page: z.coerce.number().int().min(1).max(10000).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20) }).strict();
export const movementInput = z.object({ businessDate: calendarDate, type: z.enum(['placement', 'adjustment', 'reconciliation']), count: z.number().int().min(-10000000).max(10000000), reason: z.string().trim().min(3).max(1000) }).strict();
export const measurementInput = z.object({ flockId: id, measuredAt: z.iso.datetime({ offset: true }), sampleSize: z.number().int().positive().max(1000000), averageWeight: z.number().positive().max(1000000), unit: z.enum(['g', 'kg']), notes: text }).strict();
