import { AuditEvent, Organization } from '../access/models.js';
import { entity } from '../organization/service.js';
import { allowedDateRange } from '../../policies/dates.js';
import { notFound, denied } from '../../lib/errors.js';
import { jsonValues } from '../insights/policy.js';
const clinicalTypes = ['clinical-visit', 'prescription', 'medication-task', 'bird-measurement'];
const safeKeys = new Set(['before', 'after', 'event', 'movements', 'status', 'state', 'version', 'publishedRevision', 'number', 'taskVersion', 'eventNumber', 'paymentStatus', 'dispatchStatus', 'count', 'type', 'reason', 'category', 'source', 'sourceId', 'fileId', 'commentId', 'bytes', 'purpose', 'doctorCount', 'ownerFallback', 'prescriptionId', 'visitId', 'flockId', 'farmId', 'houseId', 'siteId', 'reportId', 'replacementId', 'supersedesId', 'eventId', 'sessionsInvalidated', 'otherSessionsInvalidated', 'protectedRoleAssigned', 'cancelledTasks', 'taskCount', 'formulaId', 'previousVersionId', 'eggs', 'publicationId', 'id', 'createdAt', 'updatedAt', 'permissions', 'scopeMode', 'roleId', 'isActive', 'siteIds', 'farmIds', 'name', 'quantity', 'unit', 'itemId', 'locationId']);
function scrub(value, depth = 0) {
  if (depth > 5) return undefined;
  if (Array.isArray(value)) return value.slice(0, 100).map((v) => scrub(v, depth + 1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(jsonValues(value)).filter(([key]) => safeKeys.has(key)).map(([key, v]) => [key, scrub(v, depth + 1)]));
  return value;
}
function sourcePermission(row) {
  if (row.action.startsWith('auth.') || row.action.startsWith('user.') || row.action.startsWith('access.')) return 'users.view';
  if (row.action.startsWith('role.')) return 'roles.view';
  if (row.action.startsWith('organization.')) return 'organization.view';
  if (row.action.startsWith('inventory.')) return 'inventory.view';
  if (row.action.startsWith('formula.')) return 'feed-formulas.view';
  if (row.action.startsWith('sale.')) return 'sales.view';
  if (row.action.startsWith('expense.')) return 'finance.view';
  if (row.action.startsWith('notification.') || row.targetType === 'alert') return 'notifications.view';
  if (clinicalTypes.includes(row.targetType)) return row.targetType === 'bird-measurement' ? 'bird-parameters.view' : row.targetType === 'medication-task' ? 'medication.view' : 'clinical.view';
  if (row.targetType === 'expense') return 'finance.view';
  return 'daily-reports.view';
}
function publicEvent(actor, row, detail = false) {
  const value = { id: String(row._id), actorId: row.actorId ? String(row.actorId) : null, actorName: row.actorName || (row.actorId ? 'Recorded user' : 'System / unauthenticated'), action: row.action, targetType: row.targetType, targetId: row.targetId, createdAt: row.createdAt, requestId: row.requestId, siteId: row.siteId, farmId: row.farmId, farmIds: row.farmIds || [], houseId: row.houseId, flockId: row.flockId, businessDate: row.businessDate };
  if (detail) value.changes = actor.permissions.includes(sourcePermission(row)) ? scrub(row.changes || {}) : { redacted: 'Source read permission is required for change details.' };
  return jsonValues(value);
}
async function filterFor(actor, query) {
  if (actor.scopeMode !== 'company') throw denied();
  const org = await Organization.findById(actor.organizationId);
  const range = allowedDateRange(actor, { from: query.from, to: query.to, timezone: org.timezone });
  const date = { $dateToString: { date: '$createdAt', format: '%Y-%m-%d', timezone: org.timezone } };
  const filter = { $and: [{ $or: [{ organizationId: actor.organizationId }, { organizationId: null, action: 'auth.login-failed' }] }, { $expr: { $and: [{ $gte: [date, range.from] }, { $lte: [date, range.to] }] } }] };
  filter.createdAt = { $gte: new Date(Date.parse(range.from) - 14 * 3600000), $lt: new Date(Date.parse(range.to) + 36 * 3600000) };
  if (!actor.permissions.includes('reports.history.view')) {
    const oldest = allowedDateRange(actor, { timezone: org.timezone }).from;
    filter.$and.push({ $or: [{ businessDate: { $exists: false } }, { businessDate: { $gte: oldest } }, ...(actor.permissions.includes('clinical.history.view') ? [{ targetType: { $in: clinicalTypes } }] : [])] });
  }
  for (const key of ['actorId', 'action', 'targetType', 'targetId']) if (query[key]) filter[key] = query[key];
  if (query.farmId) { await entity(actor, 'farm', query.farmId); filter.$and.push({ $or: [{ farmId: query.farmId }, { farmIds: query.farmId }] }); }
  if (query.search) {
    const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$and.push({ $or: ['action', 'targetType', 'targetId', 'actorName', 'requestId'].map((key) => ({ [key]: { $regex: escaped, $options: 'i' } })) });
  }
  return { filter, meta: { ...range, timezone: org.timezone } };
}
export async function list(actor, query) {
  const { filter, meta } = await filterFor(actor, query);
  const [rows, total] = await Promise.all([AuditEvent.find(filter).sort({ createdAt: -1, _id: -1 }).skip((query.page - 1) * query.pageSize).limit(query.pageSize).maxTimeMS(10000), AuditEvent.countDocuments(filter).maxTimeMS(10000)]);
  return { data: rows.map((r) => publicEvent(actor, r)), meta: { ...meta, page: query.page, pageSize: query.pageSize, total } };
}
export async function detail(actor, id) {
  if (actor.scopeMode !== 'company') throw denied();
  const row = await AuditEvent.findOne({ _id: id, $or: [{ organizationId: actor.organizationId }, { organizationId: null, action: 'auth.login-failed' }] }); if (!row) throw notFound();
  const org = await Organization.findById(actor.organizationId);
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: org.timezone }).format(row.createdAt);
  allowedDateRange(actor, { from: date, to: date, timezone: org.timezone });
  if (row.businessDate) allowedDateRange(actor, { from: row.businessDate, to: row.businessDate, clinical: clinicalTypes.includes(row.targetType), timezone: org.timezone });
  return publicEvent(actor, row, true);
}
