import { parse, z } from './validation.js';

export function pageQuery(query, allowedSort = ['name', 'createdAt']) {
  const result = parse(z.object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    sort: z.enum(allowedSort.flatMap((key) => [key, `-${key}`])).default(allowedSort[0]),
    search: z.string().trim().max(100).optional(),
    role: z.string().max(50).optional(),
    status: z.enum(['active', 'inactive']).optional(),
  }).strict(), query);
  return { ...result, skip: (result.page - 1) * result.pageSize };
}

export const pageMeta = (query, total) => ({ page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) });
export const literalSearch = (value) => new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
