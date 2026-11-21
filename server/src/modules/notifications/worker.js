import { randomUUID } from 'node:crypto';
import { transaction } from '../../config/database.js';
import { SecurityGuard, Organization } from '../access/models.js';
import { hierarchyModels as H } from '../organization/models.js';
import { StockBalance, StockLocation, InventoryItem } from '../inventory/models.js';
import { MedicationTask } from '../clinical/models.js';
import { FormulaVersion } from '../formulas/models.js';
import { DailyReport } from '../reports/models.js';
import { Notification as N, NotificationEvent as E } from './models.js';
import { recipientsFor } from './service.js';
import { cleanupFiles } from '../evidence/storage.js';
import { audit } from '../access/audit.js';
import { businessDate } from '../../policies/dates.js';
export async function runReminders(config, now = new Date()) {
  await transaction(async (session) => {
    await SecurityGuard.updateOne({ _id: 'access-control' }, { $inc: { revision: 1 } }, { session });
    const desired = new Map();
    const farms = await H.farm.find({ status: 'active' }).session(session);
    for (const farm of farms) {
      const site = await H.site.findById(farm.siteId).session(session); if (site?.status !== 'active') continue;
      const organization = await Organization.findById(farm.organizationId).session(session);
      const scope = { organizationId: farm.organizationId, siteId: farm.siteId, farmId: farm._id };
      const add = (kind, row, title, message, severity, sourcePath) => desired.set(`${kind}:${row._id}`, { ...scope, kind, sourceId: row._id, title, message, severity, sourcePath, businessDate: businessDate(now, organization.timezone) });
      for (const row of await StockBalance.find({ farmId: farm._id, minimum: { $gt: 0 }, $expr: { $lt: ['$amount', '$minimum'] } }).session(session)) {
        const item = await InventoryItem.findById(row.itemId).session(session); const location = await StockLocation.findById(row.locationId).session(session);
        if (item?.active && location?.active) add('low-stock', row, 'Low stock', `${item.name} at ${location.name} is below its configured minimum.`, 'warning', '/inventory?farmId=' + farm._id + '&itemId=' + row.itemId + '&locationId=' + row.locationId);
      }
      for (const row of await MedicationTask.find({ farmId: farm._id, state: 'open', dueAt: { $lt: new Date(now - 3600000) } }).session(session)) add('overdue-medication', row, 'Overdue medication outcome', 'A scheduled occurrence is overdue by more than one hour. Review the task; this is not a treatment instruction.', 'reminder', '/medication?sourceId=' + row._id);
      for (const row of await FormulaVersion.find({ farmId: farm._id, status: 'pending_costing' }).session(session)) add('awaiting-costing', row, 'Formula awaiting costing', `Formula version ${row.number} is awaiting costing.`, 'reminder', '/feed-formulas?sourceId=' + row._id);
      for (const row of await DailyReport.find({ farmId: farm._id, publishedRevision: { $gt: 0 }, 'publishedSummary.mortalityPercent': { $gte: config.mortalityAlertPercent } }).session(session)) add('mortality', row, 'Demonstration mortality threshold', `A published report meets the configured ${config.mortalityAlertPercent}% demonstration threshold. Review its evidence; this is not veterinary advice.`, 'warning', '/daily-reports?sourceId=' + row._id);
    }
    const active = await N.find({ kind: { $ne: 'medical' }, status: { $ne: 'resolved' } }).session(session);
    // A newly assigned clinician receives still-open work on the next scan.
    // Initial routing/fallback fields remain the historical creation snapshot.
    for (const row of await N.find({ kind: 'medical', status: { $ne: 'resolved' }, farmId: { $in: farms.map((farm) => farm._id) } }).session(session)) await recipientsFor(row, session);
    const existing = new Map(active.map((row) => [row.activeKey, row]));
    for (const [key, values] of desired) {
      let row = existing.get(key);
      if (!row) {
        [row] = await N.create([{ ...values, activeKey: key, dedupKey: `${key}:${randomUUID()}` }], { session });
        await E.create([{ notificationId: row._id, action: 'generated', note: values.message, actorName: 'System reminder worker' }], { session });
        await audit({ organizationId: values.organizationId }, 'notification.generated', 'notification', row._id, { kind: values.kind, sourceId: String(values.sourceId) }, undefined, session);
      }
      await recipientsFor(row, session);
    }
    for (const row of active) if (!desired.has(row.activeKey)) {
      row.status = 'resolved'; row.resolvedAt = now; row.version += 1; await row.save({ session });
      await E.create([{ notificationId: row._id, action: 'source-cleared', note: 'The source condition cleared or its farm was archived.', actorName: 'System reminder worker' }], { session });
      await audit({ organizationId: row.organizationId }, 'notification.source-cleared', 'notification', row._id, { kind: row.kind }, undefined, session);
    }
  });
  await cleanupFiles(config, now);
}
export function startReminderWorker(config) {
  let stopped = false; let timer; let running;
  const tick = async () => {
    running = runReminders(config);
    try { await running; } catch (error) { console.error(JSON.stringify({ event: 'reminder-worker.failed', errorType: error.name })); }
    finally { running = null; if (!stopped) { timer = setTimeout(tick, config.reminderIntervalMs); timer.unref(); } }
  };
  void tick();
  return async () => { stopped = true; clearTimeout(timer); if (running) await running.catch(() => {}); };
}
