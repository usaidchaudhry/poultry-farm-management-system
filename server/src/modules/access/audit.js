import { AuditEvent } from './models.js';
import { auditContext } from './audit-context.js';
export async function audit(actor, action, targetType, targetId, changes, requestId, session) {
  const record = { organizationId: actor?.organizationId, actorId: actor?.id, actorName: actor?.name, action, targetType, targetId: targetId ? String(targetId) : undefined, changes, requestId, ...await auditContext(targetType, targetId, session) };
  await AuditEvent.create([record], session ? { session } : {});
}
