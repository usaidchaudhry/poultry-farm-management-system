import { randomUUID } from 'node:crypto';
import { DailyReport as R, ReportRevision as V, BirdMovement as B, BirdMeasurement as W, PublicationIntent as I, flockScope } from './models.js';
import { eggKeys } from './validation.js';
import { hierarchyModels as H } from '../organization/models.js';
import { entity, scopeFilter } from '../organization/service.js';
import { Organization } from '../access/models.js';
import { accessTransaction } from '../access/transactions.js';
import { audit } from '../access/audit.js';
import { AppError, notFound, denied } from '../../lib/errors.js';
import { assertVersion } from '../../lib/validation.js';
import { allowedDateRange, businessDate } from '../../policies/dates.js';
import { Decimal } from '../../lib/decimal.js';

const round = (v) => Number(new Decimal(v).toDecimalPlaces(3));
const yesterday = (date) => new Date(Date.parse(date) - 86400000).toISOString().slice(0, 10);
export function serialize(doc) {
  const { _id, ...value } = doc.toObject();
  for (const key of Object.keys(value)) if (key.endsWith('Id') || key.endsWith('By')) if (value[key]) value[key] = String(value[key]);
  return { id: String(_id), ...value };
}
async function timezone(actor, session = null) { return (await Organization.findById(actor.organizationId).session(session)).timezone; }
async function checkDate(actor, date, { write = false, reason = '', clinical = false, session = null } = {}) {
  const zone = await timezone(actor, session);
  allowedDateRange(actor, { from: date, to: date, clinical, timezone: zone });
  if (write && date < yesterday(businessDate(new Date(), zone)) && (!actor.permissions.includes('daily-reports.correct-history') || reason.trim().length < 3)) throw new AppError(403, 'HISTORICAL_CORRECTION_REQUIRED', 'Older report writes require correction permission and a reason of at least three characters.');
}
async function flockFor(actor, id, session = null, active = false) {
  const flock = await entity(actor, 'flock', id, session);
  if (active) {
    const parents = [flock, await H.house.findById(flock.houseId).session(session), await H.farm.findById(flock.farmId).session(session), await H.site.findById(flock.siteId).session(session)];
    if (parents.some((p) => !p || p.status !== 'active')) throw new AppError(409, 'ARCHIVED_CONTEXT', 'Restore the flock and its parents before recording new work.');
  }
  return flock;
}
async function reportFor(actor, id, session = null) {
  const report = await R.findOne({ _id: id, ...await scopeFilter(actor, 'flock', session) }).session(session);
  if (!report) throw notFound();
  await checkDate(actor, report.businessDate, { session });
  return report;
}
export async function population(flock, date, session = null) {
  if (date < flock.placementDate) throw new AppError(422, 'BEFORE_PLACEMENT', 'The date cannot precede flock placement.');
  const prior = await R.findOne({ flockId: flock._id, businessDate: { $lt: date }, publishedRevision: { $gt: 0 } }).sort({ businessDate: -1 }).session(session);
  const since = prior?.businessDate || flock.placementDate;
  const movements = await B.find({ flockId: flock._id, type: { $in: ['placement', 'adjustment', 'reconciliation'] }, businessDate: { ...(prior ? { $gt: since } : { $gte: since }), $lte: date } }).sort({ businessDate: 1, createdAt: 1 }).session(session);
  const opening = (prior ? prior.publishedSummary.closingBirds : flock.initialCount) + movements.filter((m) => m.businessDate < date).reduce((sum, m) => sum + m.count, 0);
  const today = movements.filter((m) => m.businessDate === date);
  const changes = today.reduce((sum, m) => sum + m.count, 0);
  const gap = date !== flock.placementDate && prior?.businessDate !== yesterday(date) && !today.some((m) => m.type === 'reconciliation');
  return { openingBirds: opening, approvedChange: changes, availableBirds: opening + changes, gap, previousReportDate: prior?.businessDate || null, movements: today.map(serialize) };
}
async function calculate(actor, flock, date, data, session, submitting = false, validating = true) {
  const pop = await population(flock, date, session);
  const errors = {};
  if (submitting) {
    for (const key of eggKeys) if (data.eggs[key] === null) errors[`data.eggs.${key}`] = 'Enter a whole number, including zero.';
    for (const key of ['mortality', 'waterLitres', 'lightHours']) if (data[key] === null) errors[`data.${key}`] = 'This value is required for submission.';
    for (const key of ['bags', 'bagSizeKg', 'additionalKg']) if (data.feed[key] === null) errors[`data.feed.${key}`] = 'Enter a value, including zero.';
    if ((data.feed.bags || 0) > 0 && !(data.feed.bagSizeKg > 0)) errors['data.feed.bagSizeKg'] = 'A positive bag size is required when using bags.';
  }
  const feedKg = round(new Decimal(data.feed.bags || 0).times(data.feed.bagSizeKg || 0).plus(data.feed.additionalKg || 0));
  if (submitting && feedKg > 0) for (const key of ['itemReference', 'locationReference']) if (!data.feed[key]) errors[`data.feed.${key}`] = 'Identify the consumed feed and its location.';
  if (Object.keys(errors).length) throw new AppError(422, 'INCOMPLETE_REPORT', 'Complete the required report fields before submitting.', errors);
  const invalidPopulation = (data.mortality || 0) > pop.availableBirds || pop.availableBirds < 0;
  if (validating && invalidPopulation) throw new AppError(422, 'INVALID_POPULATION', 'Mortality cannot exceed the available birds.');
  if (submitting && pop.gap) throw new AppError(409, 'POPULATION_GAP', 'Earlier daily reports are missing. An authorized opening reconciliation is required for this date.');
  let measurement = null;
  if (data.measurementId) {
    if (validating && !actor.permissions.includes('bird-parameters.view')) throw denied();
    const record = await W.findOne({ _id: data.measurementId, flockId: flock._id, businessDate: { $lte: date } }).session(session);
    if (!record) throw new AppError(422, 'INVALID_MEASUREMENT', 'Choose an existing measurement for this flock on or before the report date.');
    if (validating) await checkDate(actor, record.businessDate, { clinical: true, session });
    const earliest = actor.permissions.includes('reports.history.view') || actor.permissions.includes('clinical.history.view') ? new Date(Date.parse(date) - 89 * 86400000).toISOString().slice(0, 10) : yesterday(businessDate(new Date(), await timezone(actor, session)));
    const priorWeight = await W.findOne({ flockId: flock._id, measuredAt: { $lt: record.measuredAt }, businessDate: { $gte: earliest } }).sort({ measuredAt: -1 }).session(session);
    measurement = { ...serialize(record), previousGrams: priorWeight?.grams ?? null, differenceGrams: priorWeight ? round(record.grams - priorWeight.grams) : null };
  }
  const totalEggs = eggKeys.reduce((n, key) => n + (data.eggs[key] || 0), 0);
  const saleableEggs = eggKeys.slice(0, 4).reduce((n, key) => n + (data.eggs[key] || 0), 0);
  const eggSampleAverages = {};
  for (const type of ['single-egg', 'tray']) {
    const samples = data.eggSamples.filter((s) => s.sampleType === type);
    eggSampleAverages[type] = samples.length ? round(samples.reduce((sum, s) => sum.plus(new Decimal(s.value).times(s.unit === 'kg' ? 1000 : 1)), new Decimal(0)).div(samples.length)) : null;
  }
  const ageDays = flock.ageAtPlacementDays == null ? null : flock.ageAtPlacementDays + Math.round((Date.parse(date) - Date.parse(flock.placementDate)) / 86400000);
  return { ...pop, invalidPopulation, mortalityCount: data.mortality, closingBirds: pop.availableBirds - (data.mortality || 0), totalEggs, saleableEggs, petiEquivalent: round(totalEggs / 360), feedKg, feedPerBirdG: pop.openingBirds ? round(feedKg * 1000 / pop.openingBirds) : null, mortalityPercent: pop.openingBirds ? round((data.mortality || 0) * 100 / pop.openingBirds) : null, productionPercent: pop.openingBirds ? round(totalEggs * 100 / pop.openingBirds) : null, eggSampleAverages, ageDays, ageWeek: ageDays === null ? null : Math.floor(ageDays / 7) + 1, measurement, standard: null, saleabilityPolicy: 'jumbo,starter,standard,small; peti=360', stockPosting: 'deferred-until-phases-6-and-8' };
}
async function queryFilter(actor, query, clinical = false) {
  const zone = await timezone(actor);
  const { from, to } = allowedDateRange(actor, { ...query, clinical, timezone: zone });
  const filter = { ...await scopeFilter(actor, 'flock'), businessDate: { $gte: from, $lte: to } };
  for (const kind of ['site', 'farm', 'house', 'flock']) if (query[`${kind}Id`]) {
    const record = await entity(actor, kind, query[`${kind}Id`]);
    for (const parent of ['site', 'farm', 'house']) if (record[`${parent}Id`] && query[`${parent}Id`] && String(record[`${parent}Id`]) !== query[`${parent}Id`]) throw new AppError(422, 'ANCESTRY_MISMATCH', 'The requested hierarchy filters do not belong together.');
    filter[`${kind}Id`] = record._id;
  }
  return { filter, range: { from, to, today: businessDate(new Date(), zone) } };
}
export async function listReports(actor, query, mortalityOnly = false) {
  const { filter, range } = await queryFilter(actor, query);
  if (mortalityOnly) { filter.publishedRevision = { $gt: 0 }; filter['publishedSummary.mortalityCount'] = { $gt: 0 }; }
  const [records, total] = await Promise.all([R.find(filter).sort({ businessDate: -1, _id: -1 }).skip((query.page - 1) * query.pageSize).limit(query.pageSize), R.countDocuments(filter)]);
  const data = records.map(serialize);
  if (mortalityOnly) for (const row of data) {
    const revision = await V.findOne({ reportId: row.id, number: row.publishedRevision });
    row.data = revision.data; row.summary = revision.summary;
  }
  return { data, meta: { ...range, page: query.page, pageSize: query.pageSize, total } };
}
export async function reportDetail(actor, id) {
  const report = await reportFor(actor, id);
  const flock = await flockFor(actor, report.flockId);
  return { ...serialize(report), summary: await calculate(actor, flock, report.businessDate, report.data, null, false, false), birdMovements: (await B.find({ reportId: id }).sort({ createdAt: 1 })).map(serialize), revisions: (await V.find({ reportId: id }).sort({ number: -1 })).map(serialize), intents: (await I.find({ reportId: id }).sort({ revision: -1 })).map(serialize) };
}
export async function saveReport(caller, id, input, requestId) {
  return accessTransaction(caller, ['daily-reports.manage'], async (session, actor) => {
    const report = id ? await reportFor(actor, id, session) : null;
    const date = report?.businessDate || input.businessDate;
    await checkDate(actor, date, { write: true, reason: input.reason, session });
    if (report) { assertVersion(report, input.version); if (report.status === 'submitted') throw new AppError(409, 'REPORT_LOCKED', 'Return the submitted report before editing.'); }
    const flock = await flockFor(actor, report?.flockId || input.flockId, session, true);
    const summary = await calculate(actor, flock, date, input.data, session);
    summary.mortalityCount = input.data.mortality;
    const before = report ? serialize(report) : null;
    const target = report || new R({ ...flockScope(flock), businessDate: date, createdBy: actor.id, createdByName: actor.name });
    target.data = input.data; target.summary = summary; target.updatedBy = actor.id; target.updatedByName = actor.name;
    if (report) target.version += 1;
    await target.save({ session });
    await audit(actor, report ? 'report.draft-updated' : 'report.created', 'daily-report', target._id, { before, after: serialize(target), reason: input.reason }, requestId, session);
    return serialize(target);
  }, { companyOnly: false });
}
export async function transition(caller, id, input, action, requestId) {
  return accessTransaction(caller, [action === 'submit' ? 'daily-reports.submit' : 'daily-reports.review'], async (session, actor) => {
    const report = await reportFor(actor, id, session);
    assertVersion(report, input.version);
    await checkDate(actor, report.businessDate, { write: true, reason: input.reason, session });
    const flock = await flockFor(actor, report.flockId, session, true);
    const before = serialize(report);
    if (action === 'return') {
      if (report.status !== 'submitted') throw new AppError(409, 'INVALID_STATE', 'Only submitted reports can be returned.');
      if (input.reason.trim().length < 3) throw new AppError(422, 'REASON_REQUIRED', 'Explain why this report is being returned.');
      report.status = 'returned'; report.returnReason = input.reason;
    } else {
      if (report.status === 'submitted') throw new AppError(409, 'INVALID_STATE', 'This version is already submitted.');
      if (report.publishedRevision && input.reason.trim().length < 3) throw new AppError(422, 'REASON_REQUIRED', 'Explain the correction for this revision.');
      const summary = await calculate(actor, flock, report.businessDate, report.data, session, true);
      summary.mortalityCount = report.data.mortality;
      if (summary.closingBirds !== (report.publishedRevision ? report.publishedSummary.closingBirds : summary.availableBirds) && await R.exists({ flockId: flock._id, businessDate: { $gt: report.businessDate } }).session(session)) throw new AppError(409, 'DEPENDENT_POPULATION', 'Later reports depend on this population. Reconciliation is required before changing mortality.');
      const prior = report.publishedRevision ? await V.findOne({ reportId: id, number: report.publishedRevision }).session(session) : null;
      const number = report.publishedRevision + 1;
      const sourceKey = `report:${id}:revision:${number}`;
      await V.create([{ ...flockScope(flock), reportId: id, businessDate: report.businessDate, number, data: report.data, summary, reason: input.reason, submittedBy: actor.id, submittedByName: actor.name, submittedAt: new Date() }], { session });
      const mortalityDelta = report.data.mortality - (prior?.data.mortality || 0);
      if (mortalityDelta) await B.create([{ ...flockScope(flock), reportId: id, revision: number, businessDate: report.businessDate, type: 'mortality', count: -mortalityDelta, reason: input.reason || 'Daily report submission', sourceKey: `${sourceKey}:mortality`, createdBy: actor.id }], { session });
      await I.create([{ ...flockScope(flock), reportId: id, revision: number, previousRevision: report.publishedRevision, sourceKey: `${sourceKey}:production-feed`, businessDate: report.businessDate, eggDelta: Object.fromEntries(eggKeys.map((key) => [key, report.data.eggs[key] - (prior?.data.eggs[key] || 0)])), feedKgDelta: round(summary.feedKg - (prior?.summary.feedKg || 0)), feedBefore: prior?.data.feed || null, feedAfter: report.data.feed }], { session });
      report.summary = summary; report.publishedSummary = summary; report.publishedRevision = number; report.status = 'submitted'; report.returnReason = '';
    }
    report.version += 1; report.updatedBy = actor.id; report.updatedByName = actor.name;
    await report.save({ session });
    await audit(actor, `report.${action}`, 'daily-report', id, { before, after: serialize(report), reason: input.reason }, requestId, session);
    return serialize(report);
  }, { companyOnly: false });
}
export async function populationContext(actor, id, date) {
  await checkDate(actor, date);
  const flock = await flockFor(actor, id);
  return { ...await population(flock, date), businessDate: date, placementDate: flock.placementDate };
}
export async function addMovement(caller, id, input, requestId) {
  return accessTransaction(caller, ['bird-population.manage'], async (session, actor) => {
    await checkDate(actor, input.businessDate, { write: true, reason: input.reason, session });
    const flock = await flockFor(actor, id, session, true);
    if (await R.exists({ flockId: id, businessDate: { $gte: input.businessDate }, publishedRevision: { $gt: 0 } }).session(session)) throw new AppError(409, 'DEPENDENT_POPULATION', 'Submitted reports already depend on this date. Population history cannot be changed.');
    const pop = await population(flock, input.businessDate, session);
    if ((input.type === 'placement' && input.count <= 0) || (input.type === 'adjustment' && input.count === 0) || (input.type === 'reconciliation' && input.count < 0)) throw new AppError(422, 'INVALID_COUNT', 'Use positive placements, nonzero signed adjustments, or a nonnegative reconciliation target.');
    const delta = input.type === 'reconciliation' ? input.count - pop.availableBirds : input.count;
    const closing = pop.availableBirds + delta;
    const house = await H.house.findById(flock.houseId).session(session);
    if (closing < 0 || (house.capacity && closing > house.capacity)) throw new AppError(422, 'INVALID_POPULATION', 'The resulting population must be nonnegative and within house capacity.');
    const [movement] = await B.create([{ ...flockScope(flock), ...input, count: delta, sourceKey: `population:${randomUUID()}`, createdBy: actor.id }], { session });
    await audit(actor, 'population.recorded', 'bird-movement', movement._id, { ...serialize(movement), requestedCount: input.count }, requestId, session);
    return serialize(movement);
  }, { companyOnly: false });
}
export async function createMeasurement(caller, input, requestId) {
  return accessTransaction(caller, ['bird-parameters.manage'], async (session, actor) => {
    const flock = await flockFor(actor, input.flockId, session, true);
    const measuredAt = new Date(input.measuredAt);
    const date = businessDate(measuredAt, await timezone(actor, session));
    await checkDate(actor, date, { clinical: true, session });
    if (measuredAt > new Date() || date < flock.placementDate) throw new AppError(422, 'INVALID_MEASUREMENT_DATE', 'Measure between placement and the present time.');
    const grams = round(new Decimal(input.averageWeight).times(input.unit === 'kg' ? 1000 : 1));
    if (grams <= 0) throw new AppError(422, 'INVALID_WEIGHT', 'Normalized weight must be at least 0.001 grams.');
    const [measurement] = await W.create([{ ...flockScope(flock), ...input, businessDate: date, grams, createdBy: actor.id }], { session });
    await audit(actor, 'measurement.created', 'bird-measurement', measurement._id, { after: serialize(measurement) }, requestId, session);
    return serialize(measurement);
  }, { companyOnly: false });
}
export async function listMeasurements(actor, query) {
  const { filter, range } = await queryFilter(actor, query, true);
  const [rows, total, aggregates] = await Promise.all([W.find(filter).sort({ measuredAt: -1, _id: -1 }).skip((query.page - 1) * query.pageSize).limit(query.pageSize), W.countDocuments(filter), W.find(filter).select('grams sampleSize')]);
  const data = [];
  for (const row of rows) {
    const prior = await W.findOne({ flockId: row.flockId, measuredAt: { $lt: row.measuredAt }, businessDate: { $gte: range.from } }).sort({ measuredAt: -1 });
    data.push({ ...serialize(row), previousGrams: prior?.grams ?? null, differenceGrams: prior ? round(row.grams - prior.grams) : null, standard: null });
  }
  const samples = aggregates.reduce((sum, r) => sum + r.sampleSize, 0);
  return { data, meta: { ...range, page: query.page, pageSize: query.pageSize, total, sampleSize: samples, weightedAverageGrams: samples ? round(aggregates.reduce((sum, r) => sum.plus(new Decimal(r.grams).times(r.sampleSize)), new Decimal(0)).div(samples)) : null } };
}
export async function measurementDetail(actor, id) {
  const row = await W.findOne({ _id: id, ...await scopeFilter(actor, 'flock') });
  if (!row) throw notFound();
  await checkDate(actor, row.businessDate, { clinical: true });
  return { ...serialize(row), standard: null };
}
