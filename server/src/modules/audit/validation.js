import { z, id } from '../../lib/validation.js';
import { calendarDate } from '../reports/validation.js';
export const queryInput = z.strictObject({ from: calendarDate.optional(), to: calendarDate.optional(), actorId: id.optional(), farmId: id.optional(), action: z.string().trim().max(100).optional(), targetType: z.string().trim().max(80).optional(), targetId: z.string().trim().max(100).optional(), search: z.string().trim().max(100).optional(), page: z.coerce.number().int().min(1).max(10000).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20) });
