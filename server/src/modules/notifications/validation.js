import { z, id, version } from '../../lib/validation.js';
const severity = z.enum(['info', 'reminder', 'warning', 'critical', 'emergency']);
export const inboxQuery = z.strictObject({ farmId: id.optional(), status: z.enum(['open', 'acknowledged', 'resolved']).optional(), kind: z.enum(['medical', 'low-stock', 'overdue-medication', 'awaiting-costing', 'mortality']).optional(), severity: severity.optional(), view: z.enum(['current', 'history']).default('current'), page: z.coerce.number().int().min(1).max(10000).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25) });
export const alertInput = z.strictObject({ farmId: id, title: z.string().trim().min(3).max(120), message: z.string().trim().min(3).max(2000), severity });
export const actionInput = (action) => action === 'seen' ? z.strictObject({}) : z.strictObject({ version, note: action === 'respond' || action === 'resolve' ? z.string().trim().min(3).max(2000) : z.string().trim().max(2000).optional() });
