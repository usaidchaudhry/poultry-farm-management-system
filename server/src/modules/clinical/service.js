import { ClinicalVisit as V, Prescription as P, MedicationTask as T, AdministrationEvent as E, clinicalScope } from './models.js';
import { entity, scopeFilter } from '../organization/service.js';
import { hierarchyModels as H } from '../organization/models.js';
import { BirdMeasurement } from '../reports/models.js';
import { Organization } from '../access/models.js';
import { accessTransaction } from '../access/transactions.js';
import { audit } from '../access/audit.js';
import { allowedDateRange, businessDate } from '../../policies/dates.js';
import { assertIndependentAdministrator } from '../../policies/access.js';
import { assertVersion } from '../../lib/validation.js';
import { AppError, notFound, denied } from '../../lib/errors.js';
import { occurrences } from './schedule.js';
import { serialize } from '../reports/service.js';

const priorDay = (date) => new Date(Date.parse(date) - 86400000).toISOString().slice(0, 10);
const zone = async (actor, session = null) => (await Organization.findById(actor.organizationId).session(session)).timezone;
const range = async (actor, query = {}, session = null) => allowedDateRange(actor, { ...query, clinical: true, timezone: await zone(actor, session) });
async function dateAccess(actor, date, session = null) { return range(actor, { from: date, to: date }, session); }
async function activeFlock(actor, id, session) {
  const f = await entity(actor, 'flock', id, session);
  const parents = [f, await H.house.findById(f.houseId).session(session), await H.farm.findById(f.farmId).session(session), await H.site.findById(f.siteId).session(session)];
  if (parents.some((r) => !r || r.status !== 'active')) throw new AppError(409, 'ARCHIVED_CONTEXT', 'Restore the flock and its parents before new clinical work.');
  return f;
}
async function scoped(model, actor, id, session = null) {
  const record = await model.findOne({ _id: id, ...await scopeFilter(actor, 'flock', session) }).session(session);
  if (!record) throw notFound(); return record;
}
async function visitFor(actor, id, session = null) {
  const visit = await scoped(V, actor, id, session); await dateAccess(actor, visit.businessDate, session); return visit;
}
async function prescriptionFor(actor, id, session = null) {
  const prescription = await scoped(P, actor, id, session); await visitFor(actor, prescription.visitId, session); return prescription;
}
async function filters(actor, query) {
  const filter = await scopeFilter(actor, 'flock');
  if (query.farmId) { await entity(actor, 'farm', query.farmId); filter.farmId = query.farmId; }
  if (query.flockId) {
    const flock = await entity(actor, 'flock', query.flockId);
    if (query.farmId && String(flock.farmId) !== query.farmId) throw new AppError(422, 'ANCESTRY_MISMATCH', 'These farm/flock filters do not belong together.');
    filter.flockId = query.flockId;
  }
  return filter;
}
const meta = (query, total, extras = {}) => ({ page: query.page, pageSize: query.pageSize, total, ...extras });
const tx = (actor, permission, work) => accessTransaction(actor, [permission], work, { companyOnly: false });

export async function listVisits(actor, query) {
  const dates = await range(actor, query); const filter = { ...await filters(actor, query), businessDate: { $gte: dates.from, $lte: dates.to } };
  const [rows, total] = await Promise.all([V.find(filter).sort({ occurredAt: -1 }).skip((query.page - 1) * query.pageSize).limit(query.pageSize), V.countDocuments(filter)]);
  return { data: rows.map(serialize), meta: meta(query, total, { ...dates, today: businessDate(new Date(), await zone(actor)), timezone: await zone(actor) }) };
}
export async function visitDetail(actor, id) {
  const visit = await visitFor(actor, id);
  const measurement = visit.measurementId ? await BirdMeasurement.findById(visit.measurementId) : null;
  return { ...serialize(visit), measurement: measurement ? { grams: measurement.grams, sampleSize: measurement.sampleSize, measuredAt: measurement.measuredAt, standard: null } : null, prescriptions: (await P.find({ visitId: id }).sort({ sequence: -1 })).map(serialize) };
}
export async function saveVisit(caller, id, input, requestId) {
  return tx(caller, 'clinical.manage', async (session, actor) => {
    const visit = id ? await visitFor(actor, id, session) : null;
    if (visit) {
      assertVersion(visit, input.version);
      if (await P.exists({ visitId: id, status: { $ne: 'draft' } }).session(session)) throw new AppError(409, 'VISIT_LOCKED', 'A visit with finalized or cancelled prescription evidence cannot be edited.');
    }
    const flock = await activeFlock(actor, visit?.flockId || input.flockId, session);
    const occurredAt = new Date(input.occurredAt); const date = businessDate(occurredAt, await zone(actor, session));
    await dateAccess(actor, date, session);
    if (occurredAt > new Date() || date < flock.placementDate) throw new AppError(422, 'INVALID_VISIT_DATE', 'The visit must be between placement and the present time.');
    if (input.measurementId) {
      if (!actor.permissions.includes('bird-parameters.view')) throw denied();
      const measurement = await BirdMeasurement.findOne({ _id: input.measurementId, flockId: flock._id, measuredAt: { $lte: occurredAt } }).session(session);
      if (!measurement) throw new AppError(422, 'INVALID_MEASUREMENT', 'Choose a preceding measurement from this flock.');
      await dateAccess(actor, measurement.businessDate, session);
    }
    const before = visit ? serialize(visit) : null;
    const record = visit || new V({ ...clinicalScope(flock), recordedBy: actor.id, recordedByName: actor.name });
    const { version, flockId, ...values } = input; Object.assign(record, values, { businessDate: date });
    if (visit) record.version += 1;
    await record.save({ session });
    await audit(actor, visit ? 'clinical.visit-updated' : 'clinical.visit-created', 'clinical-visit', record._id, { before, after: serialize(record) }, requestId, session);
    return serialize(record);
  });
}
async function scheduleFor(actor, visit, items, session = null, finalizing = false) {
  const timezone = await zone(actor, session); const today = businessDate(new Date(), timezone);
  const latestStart = new Date(Date.parse(today) + 30 * 86400000).toISOString().slice(0, 10);
  for (const item of items) {
    if (item.startDate < visit.businessDate || item.startDate > latestStart) throw new AppError(422, 'INVALID_SCHEDULE', 'Start on/after the visit and within 30 days from today.');
    if (finalizing && item.startDate < priorDay(today)) throw new AppError(422, 'BACKDATED_SCHEDULE', 'Newly finalized treatment cannot start before yesterday. History permission does not bypass this limit.');
  }
  return { timezone, occurrences: occurrences(items, timezone) };
}
export async function preview(actor, visitId, input) { return scheduleFor(actor, await visitFor(actor, visitId), input.items); }
export async function savePrescription(caller, id, visitId, input, requestId) {
  return tx(caller, 'clinical.manage', async (session, actor) => {
    const prescription = id ? await prescriptionFor(actor, id, session) : null;
    const visit = await visitFor(actor, prescription?.visitId || visitId, session);
    const flock = await activeFlock(actor, visit.flockId, session);
    if (prescription) { assertVersion(prescription, input.version); if (prescription.status !== 'draft') throw new AppError(409, 'PRESCRIPTION_LOCKED', 'Finalized prescription content is immutable. Create a replacement.'); }
    else if (await P.exists({ visitId }).session(session)) throw new AppError(409, 'PRESCRIPTION_EXISTS', 'Use the existing prescription or its replacement action.');
    const schedule = await scheduleFor(actor, visit, input.items, session);
    const record = prescription || new P({ ...clinicalScope(flock), visitId, sequence: 1, prescribedBy: actor.id, prescribedByName: actor.name });
    record.items = input.items; record.timezone = schedule.timezone;
    if (prescription) record.version += 1;
    await record.save({ session });
    await audit(actor, 'clinical.prescription-draft', 'prescription', record._id, { after: serialize(record) }, requestId, session);
    return serialize(record);
  });
}
async function generateTasks(record, schedule, session) {
  const scope = Object.fromEntries(['organizationId', 'siteId', 'farmId', 'houseId', 'flockId'].map((key) => [key, record[key]]));
  const rows = schedule.occurrences.map((occurrence) => {
    const item = record.items.find((r) => r.key === occurrence.itemKey);
    return { ...scope, ...occurrence, visitId: record.visitId, prescriptionId: record._id, medicineReference: item.medicineReference, route: item.route, doseValue: item.doseValue, doseUnit: item.doseUnit, instructions: item.instructions, batchLabel: item.batchLabel, timezone: schedule.timezone, prescribedBy: record.prescribedBy, prescribedByName: record.prescribedByName };
  });
  await T.insertMany(rows, { session, ordered: true });
}
export async function finalize(caller, id, input, requestId) {
  return tx(caller, 'clinical.manage', async (session, actor) => {
    const record = await prescriptionFor(actor, id, session); assertVersion(record, input.version);
    if (record.status !== 'draft') throw new AppError(409, 'PRESCRIPTION_LOCKED', 'Only draft prescriptions can be finalized.');
    await activeFlock(actor, record.flockId, session);
    const schedule = await scheduleFor(actor, await visitFor(actor, record.visitId, session), record.items, session, true);
    record.status = 'finalized'; record.finalizedAt = new Date(); record.timezone = schedule.timezone; record.version += 1;
    // Finalization never transfers the original prescriber's responsibility or
    // lets them bypass separation of duties through another finalizing actor.
    record.finalizedBy = actor.id; record.finalizedByName = actor.name;
    await record.save({ session }); await generateTasks(record, schedule, session);
    await audit(actor, 'clinical.prescription-finalized', 'prescription', id, { taskCount: schedule.occurrences.length, after: serialize(record) }, requestId, session);
    return { ...serialize(record), taskCount: schedule.occurrences.length };
  });
}
export async function cancelOrReplace(caller, id, input, replace, requestId) {
  return tx(caller, 'clinical.manage', async (session, actor) => {
    const record = await prescriptionFor(actor, id, session); assertVersion(record, input.version);
    if (input.reason.trim().length < 3) throw new AppError(422, 'REASON_REQUIRED', 'Explain the cancellation or replacement.');
    if (!['draft', 'finalized'].includes(record.status) || (replace && record.status === 'draft')) throw new AppError(409, 'INVALID_STATE', 'Only an active finalized prescription can be replaced; drafts may be cancelled.');
    await activeFlock(actor, record.flockId, session);
    const now = new Date(); const hasOutcome = await E.exists({ prescriptionId: id }).session(session);
    const eligible = { prescriptionId: id, state: 'open', ...(hasOutcome ? { dueAt: { $gt: now } } : {}) };
    const count = await T.countDocuments(eligible).session(session);
    if (record.status === 'finalized' && !count) throw new AppError(409, 'NO_FUTURE_TASKS', 'Recorded evidence and elapsed tasks cannot be cancelled after an outcome. Resolve remaining elapsed tasks independently.');
    let replacement = null;
    if (replace) {
      const visit = await visitFor(actor, record.visitId, session);
      const schedule = await scheduleFor(actor, visit, input.items, session, true);
      if (hasOutcome && schedule.occurrences.some((r) => r.dueAt <= now)) throw new AppError(422, 'REPLACEMENT_MUST_BE_FUTURE', 'After an outcome, replacement occurrences must all be in the future.');
      const scope = Object.fromEntries(['organizationId', 'siteId', 'farmId', 'houseId', 'flockId'].map((key) => [key, record[key]]));
      [replacement] = await P.create([{ ...scope, visitId: record.visitId, sequence: record.sequence + 1, previousId: id, status: 'finalized', items: input.items, timezone: schedule.timezone, prescribedBy: actor.id, prescribedByName: actor.name, finalizedAt: now, finalizedBy: actor.id, finalizedByName: actor.name, reason: input.reason }], { session });
      await generateTasks(replacement, schedule, session); record.replacedById = replacement._id;
    }
    await T.updateMany(eligible, { $set: { state: 'cancelled', cancelledAt: now, cancelledBusinessDate: businessDate(now, await zone(actor, session)), cancellationReason: input.reason }, $inc: { version: 1 } }, { session });
    record.status = 'cancelled'; record.cancelledAt = now; record.reason = input.reason; record.version += 1; await record.save({ session });
    await audit(actor, replace ? 'clinical.prescription-replaced' : 'clinical.prescription-cancelled', 'prescription', id, { reason: input.reason, cancelledTasks: count, replacementId: replacement?._id || null, after: serialize(record) }, requestId, session);
    return { prescription: serialize(record), replacement: replacement ? serialize(replacement) : null, cancelledTasks: count };
  });
}
export function taskStatus(task, now = new Date()) {
  if (task.state !== 'open') return task.state;
  if (task.dueAt > now) return 'scheduled';
  return now - task.dueAt >= 3600000 ? 'overdue' : 'due';
}
async function taskRow(task) {
  return { ...serialize(task), displayStatus: taskStatus(task), effectiveOutcome: task.effectiveEventId ? serialize(await E.findById(task.effectiveEventId)) : null };
}
export async function listTasks(actor, query) {
  const filter = await filters(actor, query); const now = new Date(); let dates = {};
  if (query.view === 'open') {
    if (query.from || query.to) throw new AppError(422, 'OPEN_TASK_RANGE', 'Open work is current state; use history for date filters.');
    filter.state = 'open';
    if (query.status === 'scheduled') filter.dueAt = { $gt: now };
    else if (query.status === 'due') filter.dueAt = { $lte: now, $gt: new Date(now - 3600000) };
    else if (query.status === 'overdue') filter.dueAt = { $lte: new Date(now - 3600000) };
    else if (query.status) throw new AppError(422, 'INVALID_FILTER', 'Closed states require the history view.');
  } else {
    dates = await range(actor, query); filter.state = { $ne: 'open' };
    // Closed outcomes are filtered by actual event business date, allowing a
    // delayed recording of a genuinely current outcome on an old open task.
    filter.$and = [{ $or: [{ state: { $in: ['completed', 'missed'] }, outcomeBusinessDate: { $gte: dates.from, $lte: dates.to } }, { state: 'cancelled', cancelledBusinessDate: { $gte: dates.from, $lte: dates.to } }] }];
    if (query.status) {
      if (!['completed', 'missed', 'cancelled'].includes(query.status)) throw new AppError(422, 'INVALID_FILTER', 'Use an outcome state in history.');
      filter.state = query.status;
    }
  }
  const [rows, total] = await Promise.all([T.find(filter).sort({ dueAt: query.view === 'open' ? 1 : -1 }).skip((query.page - 1) * query.pageSize).limit(query.pageSize), T.countDocuments(filter)]);
  return { data: await Promise.all(rows.map(taskRow)), meta: meta(query, total, { ...dates, today: businessDate(now, await zone(actor)), view: query.view }) };
}
export async function taskDetail(actor, id) {
  const task = await scoped(T, actor, id);
  if (task.state !== 'open') await dateAccess(actor, task.outcomeBusinessDate || businessDate(task.cancelledAt, task.timezone));
  const history = actor.permissions.includes('reports.history.view') || actor.permissions.includes('clinical.history.view');
  const oldest = history ? null : priorDay(businessDate(new Date(), await zone(actor)));
  const events = await E.find({ taskId: id, ...(oldest ? { businessDate: { $gte: oldest } } : {}) }).sort({ number: -1 });
  return { ...await taskRow(task), events: events.map(serialize) };
}
export async function recordOutcome(caller, id, input, correction, requestId) {
  return tx(caller, correction ? 'medication.correct' : 'medication.administer', async (session, actor) => {
    const task = await scoped(T, actor, id, session); assertVersion(task, input.version);
    assertIndependentAdministrator(actor.id, task.prescribedBy);
    if (task.state === 'cancelled' || (correction ? !['completed', 'missed'].includes(task.state) : task.state !== 'open')) throw new AppError(409, 'OUTCOME_EXISTS', 'Use the current task version and the authorized correction action for existing outcomes.');
    if (correction && input.reason.trim().length < 3) throw new AppError(422, 'REASON_REQUIRED', 'Explain this correction.');
    const actualAt = new Date(input.actualAt); const now = new Date(); const timezone = await zone(actor, session); const date = businessDate(actualAt, timezone);
    if (actualAt > now || actualAt < task.dueAt) throw new AppError(422, 'INVALID_ACTUAL_TIME', 'Actual time must be on/after the scheduled occurrence and no later than now.');
    if (date < priorDay(businessDate(now, timezone)) && (!actor.permissions.includes('medication.correct') || input.reason.trim().length < 3)) throw new AppError(403, 'HISTORICAL_OUTCOME_FORBIDDEN', 'Backdated actual outcomes require correction permission and a reason.');
    const prescription = await P.findById(task.prescriptionId).session(session);
    if (input.outcome === 'completed' && prescription.cancelledAt && actualAt > prescription.cancelledAt) throw new AppError(422, 'CANCELLED_TREATMENT', 'A late completion must describe administration before the prescription was cancelled.');
    // Open-task action is intentionally independent of visit-history grants and
    // remains possible after archive only if no new task can be created there.
    const scope = Object.fromEntries(['organizationId', 'siteId', 'farmId', 'houseId', 'flockId'].map((key) => [key, task[key]]));
    const [event] = await E.create([{ ...scope, taskId: id, prescriptionId: task.prescriptionId, number: task.eventNumber + 1, supersedesId: task.effectiveEventId || null, outcome: input.outcome, actualAt, businessDate: date, actualDose: input.actualDose, doseUnit: input.doseUnit, instructionReference: input.instructionReference, comments: input.comments, reason: input.reason, recordedBy: actor.id, recordedByName: actor.name, recordedAt: now }], { session });
    task.state = input.outcome; task.eventNumber += 1; task.effectiveEventId = event._id; task.outcomeBusinessDate = date; task.version += 1; await task.save({ session });
    if (prescription.status === 'finalized' && !await T.exists({ prescriptionId: prescription._id, state: 'open' }).session(session)) { prescription.status = 'completed'; prescription.version += 1; await prescription.save({ session }); }
    await audit(actor, correction ? 'medication.outcome-corrected' : 'medication.outcome-recorded', 'medication-task', id, { event: serialize(event), supersedesId: event.supersedesId, taskVersion: task.version }, requestId, session);
    return { ...serialize(task), displayStatus: taskStatus(task), effectiveOutcome: serialize(event) };
  });
}
