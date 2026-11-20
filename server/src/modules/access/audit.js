import { AuditEvent } from './models.js';
export async function audit(actor, action, targetType, targetId, changes, requestId, session) {
  const record = { organizationId: actor?.organizationId, actorId: actor?.id, action, targetType, targetId: targetId ? String(targetId) : undefined, changes, requestId };
  await AuditEvent.create([record], session ? { session } : {});
}
