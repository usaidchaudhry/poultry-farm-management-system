import { DailyReport } from '../reports/models.js';
import { ClinicalVisit, Prescription } from '../clinical/models.js';
import { Expense } from '../commerce/models.js';
import { Organization } from '../access/models.js';
import { entity, scopeFilter } from '../organization/service.js';
import { hierarchyModels as H } from '../organization/models.js';
import { allowedDateRange } from '../../policies/dates.js';
import { notificationFor } from '../notifications/policy.js';
import { denied, notFound, AppError } from '../../lib/errors.js';
export const parents = { report: [DailyReport, 'daily-reports.view', 'daily-reports.manage'], 'clinical-visit': [ClinicalVisit, 'clinical.view', 'clinical.manage'], expense: [Expense, 'finance.view', 'finance.manage'], alert: [null, 'notifications.view', 'notifications.raise'] };
export async function parentFor(actor, type, id, writing = false, session = null) {
  const config = parents[type]; if (!config) throw notFound();
  if (!actor.permissions.includes(config[1])) throw denied();
  let row;
  if (type === 'alert') row = await notificationFor(actor, id, session);
  else {
    row = await config[0].findOne({ _id: id, ...await scopeFilter(actor, 'flock', session) }).session(session);
    if (!row) throw notFound();
    const org = await Organization.findById(actor.organizationId).session(session);
    allowedDateRange(actor, { from: row.businessDate, to: row.businessDate, clinical: type === 'clinical-visit', timezone: org.timezone });
  }
  let editable = type === 'report' ? row.status !== 'submitted' : type === 'expense' ? row.status === 'active' : type === 'alert' ? row.kind === 'medical' && row.status !== 'resolved' : !await Prescription.exists({ visitId: id, status: { $ne: 'draft' } }).session(session);
  const farm = await entity(actor, 'farm', String(row.farmId), session);
  const site = await H.site.findById(row.siteId).session(session);
  const flock = row.flockId ? await H.flock.findById(row.flockId).session(session) : null;
  const house = row.houseId ? await H.house.findById(row.houseId).session(session) : null;
  const activeContext = [farm, site, ...(row.flockId ? [flock] : []), ...(row.houseId ? [house] : [])].every((parent) => parent?.status === 'active');
  editable &&= activeContext;
  const canWrite = actor.permissions.includes(config[2]) || (type === 'alert' && actor.permissions.includes('notifications.respond'));
  if (writing) {
    if (!canWrite) throw denied();
    if (!activeContext) throw new AppError(409, 'ARCHIVED_CONTEXT', 'Restore the parent farm context before changing evidence.');
    if (!editable) throw new AppError(409, 'EVIDENCE_LOCKED', 'This parent is closed or submitted; its evidence is retained.');
  }
  return { row, editable: editable && canWrite };
}
