import { Router } from 'express';
import { z, id, version, displayName, body, parse, validId } from '../../lib/validation.js';
import { permission, companyScope } from '../../middleware/auth.js';
import { P } from '../access/catalog.js';
import * as service from './service.js';

const count = z.number().int().positive().max(10000000);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, 'Use a valid date.');
const fields = {
  site: { name: displayName, location: z.string().trim().min(2).max(300) },
  farm: { name: displayName }, house: { name: displayName, capacity: count.nullable().default(null) },
  flock: { name: displayName, birdType: z.enum(['Layer', 'Broiler', 'Other', '']).default(''), strain: z.string().trim().max(100).default(''), ageAtPlacementDays: z.number().int().min(0).max(2000).nullable().default(null), placementDate: date, initialCount: count },
};
export const organizationRouter = Router();
organizationRouter.get('/hierarchy', permission(P.ORGANIZATION_VIEW), async (req, res) => res.json({ data: await service.hierarchy(req.actor) }));
organizationRouter.get('/assignments', companyScope, permission(P.USERS_MANAGE, P.ORGANIZATION_MANAGE), async (req, res) => res.json({ data: await service.assignments(req.actor) }));
for (const kind of service.kinds) {
  const path = `/${kind}s`;
  const parent = service.kinds[service.kinds.indexOf(kind) - 1];
  organizationRouter.get(path, permission(P.ORGANIZATION_VIEW), async (req, res) => res.json({ data: (await service.hierarchy(req.actor))[`${kind}s`] }));
  organizationRouter.get(`${path}/:id`, permission(P.ORGANIZATION_VIEW), validId, async (req, res) => res.json({ data: service.publicEntity(await service.entity(req.actor, kind, req.params.id)) }));
  organizationRouter.post(path, permission(P.ORGANIZATION_MANAGE), body(z.object({ ...fields[kind], ...(parent ? { [`${parent}Id`]: id } : {}) }).strict()), async (req, res) => res.status(201).json({ data: await service.mutate(req.actor, kind, null, req.input, req.id, 'create') }));
  const editable = kind === 'flock' ? { name: displayName, birdType: fields.flock.birdType, strain: fields.flock.strain } : fields[kind];
  organizationRouter.patch(`${path}/:id`, permission(P.ORGANIZATION_MANAGE), validId, body(z.object({ ...editable, version }).strict()), async (req, res) => res.json({ data: await service.mutate(req.actor, kind, req.params.id, req.input, req.id, 'update') }));
  organizationRouter.patch(`${path}/:id/status`, permission(P.ORGANIZATION_MANAGE), validId, body(z.object({ archived: z.boolean(), version }).strict()), async (req, res) => res.json({ data: await service.mutate(req.actor, kind, req.params.id, req.input, req.id, 'status') }));
}
export const scopeBody = z.object({ siteIds: z.array(id).max(500), farmIds: z.array(id).max(500), version }).strict().refine((v) => new Set(v.siteIds).size === v.siteIds.length && new Set(v.farmIds).size === v.farmIds.length, 'Remove duplicate assignments.');
export async function assignScope(req, res) {
  parse(id, req.params.id);
  res.json({ data: await service.assign(req.actor, req.params.id, parse(scopeBody, req.body), req.id) });
}
