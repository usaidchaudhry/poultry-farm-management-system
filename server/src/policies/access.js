import { AppError, denied, notFound } from '../lib/errors.js';

export function assertPermission(actor, permission) {
  if (!actor || !actor.isActive || !actor.permissions.includes(permission)) throw denied();
}

export function assertScope(actor, resource) {
  if (!actor?.roleId || String(resource.organizationId) !== String(actor.organizationId)) throw notFound();
  if (actor.scopeMode === 'company') return;
  if (resource.farmId && actor.farmIds.includes(String(resource.farmId))) return;
  if (resource.siteId && actor.siteIds.includes(String(resource.siteId))) return;
  throw notFound();
}

export function scopedFarmFilter(actor) {
  if (!actor?.roleId) throw denied();
  const filter = { organizationId: actor.organizationId };
  if (actor.scopeMode !== 'company') filter.$or = [{ farmId: { $in: actor.farmIds } }, { siteId: { $in: actor.siteIds } }];
  return filter;
}

export function assertIndependentAdministrator(actorId, prescriberId) {
  if (String(actorId) === String(prescriberId)) throw new AppError(403, 'SEPARATION_OF_DUTIES', 'You cannot record an outcome for your own prescription.');
}
