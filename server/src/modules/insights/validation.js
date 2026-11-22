import { z, id } from '../../lib/validation.js';
import { calendarDate } from '../reports/validation.js';
export const reportQuery = z.strictObject({ from: calendarDate.optional(), to: calendarDate.optional(), siteId: id.optional(), farmId: id.optional(), houseId: id.optional(), flockId: id.optional(), status: z.string().max(40).optional(), category: z.string().max(40).optional(), page: z.coerce.number().int().min(1).max(10000).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20) });
export const dashboardQuery = reportQuery.omit({ status: true, category: true, page: true, pageSize: true });
