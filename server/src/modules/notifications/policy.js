import { Notification, NotificationRecipient } from './models.js';
import { entity } from '../organization/service.js';
import { Organization } from '../access/models.js';
import { allowedDateRange } from '../../policies/dates.js';
import { denied, notFound } from '../../lib/errors.js';
export const sourcePermission = { medical: 'notifications.view', 'low-stock': 'inventory.view', 'overdue-medication': 'medication.view', 'awaiting-costing': 'feed-formulas.cost', mortality: 'daily-reports.view' };
export async function notificationFor(actor, id, session = null) {
  if (!actor.permissions.includes('notifications.view')) throw denied();
  const row = await Notification.findOne({ _id: id, organizationId: actor.organizationId }).session(session);
  if (!row || !await NotificationRecipient.exists({ notificationId: id, userId: actor.id }).session(session)) throw notFound();
  await entity(actor, 'farm', String(row.farmId), session);
  if (!actor.permissions.includes(sourcePermission[row.kind])) throw denied();
  // Open operational alerts remain actionable; this does not unlock old source records.
  if (row.status === 'resolved') {
    const org = await Organization.findById(actor.organizationId).session(session);
    allowedDateRange(actor, { from: row.businessDate, to: row.businessDate, clinical: row.kind === 'medical' || row.kind === 'overdue-medication', timezone: org.timezone });
  }
  return row;
}
