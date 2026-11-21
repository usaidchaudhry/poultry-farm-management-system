import { Notification as N, NotificationRecipient as R, NotificationEvent as E } from './models.js';
import { notificationFor, sourcePermission } from './policy.js';
import { User, Organization } from '../access/models.js';
import { actorFrom } from '../access/serialization.js';
import { entity, scopeFilter } from '../organization/service.js';
import { accessTransaction } from '../access/transactions.js';
import { audit } from '../access/audit.js';
import { serialize } from '../reports/service.js';
import { businessDate } from '../../policies/dates.js';
import { assertVersion } from '../../lib/validation.js';
import { AppError } from '../../lib/errors.js';
const tx = (actor, permission, work) => accessTransaction(actor, ['notifications.view', permission], work, { companyOnly: false });
export async function recipientsFor(row, session) {
  const users = await User.find({ organizationId: row.organizationId, isActive: true, mustChangePassword: false }).populate('roleId').session(session);
  const scoped = users.map(actorFrom).filter((a) => a.permissions.includes('notifications.view') && (a.scopeMode === 'company' || a.siteIds.includes(String(row.siteId)) || a.farmIds.includes(String(row.farmId))));
  const doctors = scoped.filter((a) => a.scopeMode === 'assigned' && a.permissions.includes('clinical.manage') && a.permissions.includes('notifications.respond'));
  let selected;
  if (row.kind === 'medical') {
    selected = scoped.filter((a) => doctors.some((d) => d.id === a.id) || (a.scopeMode === 'company' && a.permissions.includes('notifications.resolve')) || a.id === String(row.raisedBy));
    // Protected Owner remains the explicit fallback when no assigned clinician exists.
    if (!doctors.length) selected.push(...scoped.filter((a) => a.isProtected));
  } else selected = scoped.filter((a) => a.permissions.includes(sourcePermission[row.kind]));
  for (const a of new Map(selected.map((a) => [a.id, a])).values()) await R.updateOne({ notificationId: row._id, userId: a.id }, { $setOnInsert: { deliveredToInboxAt: new Date() } }, { upsert: true, session });
  return { doctorCount: doctors.length, ownerFallback: !doctors.length };
}
export async function raise(caller, input, requestId) {
  return tx(caller, 'notifications.raise', async (session, actor) => {
    const farm = await entity(actor, 'farm', input.farmId, session, true);
    const site = await entity(actor, 'site', String(farm.siteId), session);
    if (farm.status !== 'active' || site.status !== 'active') throw new AppError(409, 'ARCHIVED_CONTEXT', 'Restore this farm and site before raising an alert.');
    const org = await Organization.findById(actor.organizationId).session(session);
    const [row] = await N.create([{ organizationId: actor.organizationId, siteId: farm.siteId, farmId: farm._id, kind: 'medical', title: input.title, message: input.message, severity: input.severity, businessDate: businessDate(new Date(), org.timezone), raisedBy: actor.id, raisedByName: actor.name, sourcePath: '/notifications' }], { session });
    Object.assign(row, await recipientsFor(row, session)); await row.save({ session });
    await E.create([{ notificationId: row._id, action: 'raised', note: input.message, actorId: actor.id, actorName: actor.name, clinical: false }], { session });
    await audit(actor, 'notification.raised', 'notification', row._id, { farmId: input.farmId, severity: input.severity, doctorCount: row.doctorCount, ownerFallback: row.ownerFallback }, requestId, session);
    return serialize(row);
  });
}
export async function list(actor, query, unreadOnly = false) {
  const recipientIds = await R.find({ userId: actor.id, ...(unreadOnly ? { seenAt: null } : {}) }).distinct('notificationId');
  const filter = { ...await scopeFilter(actor, 'flock'), _id: { $in: recipientIds } };
  if (query.farmId) { await entity(actor, 'farm', query.farmId); filter.farmId = query.farmId; }
  if (query.status) filter.status = query.status;
  else if (query.view !== 'history') filter.status = { $ne: 'resolved' };
  if (query.kind) filter.kind = query.kind;
  if (query.severity) filter.severity = query.severity;
  const data = []; let total = 0;
  for await (const row of N.find(filter).sort({ createdAt: -1, _id: -1 }).cursor()) {
    try { await notificationFor(actor, String(row._id)); } catch (error) { if ([403, 404].includes(error.status)) continue; throw error; }
    total += 1;
    if (!unreadOnly && total > (query.page - 1) * query.pageSize && data.length < query.pageSize) {
      const recipient = await R.findOne({ notificationId: row._id, userId: actor.id });
      data.push({ ...serialize(row), inbox: serialize(recipient) });
    }
  }
  return unreadOnly ? { count: total } : { data, meta: { page: query.page, pageSize: query.pageSize, total } };
}
export async function detail(actor, id) {
  const row = await notificationFor(actor, id);
  return { ...serialize(row), inbox: serialize(await R.findOne({ notificationId: id, userId: actor.id })), events: (await E.find({ notificationId: id }).sort({ createdAt: 1, _id: 1 })).map(serialize) };
}
export async function action(caller, id, action, input, requestId) {
  return tx(caller, action === 'seen' ? 'notifications.view' : `notifications.${action === 'acknowledge' ? 'acknowledge' : action === 'respond' ? 'respond' : 'resolve'}`, async (session, actor) => {
    const row = await notificationFor(actor, id, session);
    const recipient = await R.findOne({ notificationId: id, userId: actor.id }).session(session);
    if (action === 'seen') { if (!recipient.seenAt) { recipient.seenAt = new Date(); await recipient.save({ session }); } return { seen: true }; }
    if (row.kind !== 'medical') throw new AppError(409, 'SOURCE_WORKFLOW_REQUIRED', 'Resolve this reminder through its source workflow.');
    assertVersion(row, input.version);
    if (row.status === 'resolved') throw new AppError(409, 'ALERT_RESOLVED', 'This alert is resolved.');
    if (action === 'resolve' && ['critical', 'emergency'].includes(row.severity) && row.status !== 'acknowledged') throw new AppError(409, 'ACKNOWLEDGEMENT_REQUIRED', 'Acknowledge critical and emergency alerts before resolving them.');
    if (action === 'acknowledge') { recipient.acknowledgedAt ||= new Date(); recipient.seenAt ||= new Date(); await recipient.save({ session }); row.status = 'acknowledged'; row.acknowledgedAt ||= new Date(); }
    if (action === 'resolve') { row.status = 'resolved'; row.resolvedAt = new Date(); }
    row.version += 1; await row.save({ session });
    await E.create([{ notificationId: id, action, note: input.note || '', actorId: actor.id, actorName: actor.name, clinical: actor.permissions.includes('clinical.manage') }], { session });
    await audit(actor, `notification.${action}`, 'notification', id, { status: row.status, version: row.version }, requestId, session);
    return serialize(row);
  });
}
