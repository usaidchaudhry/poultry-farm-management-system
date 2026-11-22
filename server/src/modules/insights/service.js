import { catalog, permitted, publicDescriptor } from './catalog.js';
import { context, jsonValues } from './policy.js';
import { Sale, Expense } from '../commerce/models.js';
import { MedicationTask } from '../clinical/models.js';
import { Notification, NotificationRecipient } from '../notifications/models.js';
import { notificationFor } from '../notifications/policy.js';
import { AppError, denied, notFound } from '../../lib/errors.js';
import { Decimal } from '../../lib/decimal.js';
const timeout = { maxTimeMS: 10000 };
const sum = (field) => ({ $sum: { $ifNull: [`$${field}`, 0] } });
const rounded = (value, digits = 3) => value === null ? null : new Decimal(String(value || 0)).toDecimalPlaces(digits).toString();
export function available(actor) { return Object.entries(catalog).filter(([, d]) => permitted(actor, d)).map(([key, d]) => publicDescriptor(key, d)); }
function descriptorFor(actor, type) { const d = catalog[type]; if (!d) throw notFound(); if (!permitted(actor, d)) throw denied(); return d; }
async function financial(filter) {
  return Sale.aggregate([
    { $match: { ...filter, status: 'posted' } },
    { $project: { businessDate: 1, revenue: '$total', unpaid: { $cond: [{ $eq: ['$paymentStatus', 'pending'] }, '$total', 0] }, recordedCost: { $literal: 0 } } },
    { $unionWith: { coll: Expense.collection.name, pipeline: [{ $match: { ...filter, status: 'active' } }, { $project: { businessDate: 1, recordedCost: '$amount', revenue: { $literal: 0 }, unpaid: { $literal: 0 } } }] } },
    { $group: { _id: '$businessDate', revenue: sum('revenue'), unpaid: sum('unpaid'), recordedCost: sum('recordedCost') } },
    { $project: { _id: 0, id: '$_id', businessDate: '$_id', revenue: 1, unpaid: 1, recordedCost: 1, operatingSurplus: { $subtract: ['$revenue', '$recordedCost'] } } }, { $sort: { businessDate: -1 } },
  ]).option(timeout);
}
export async function report(actor, type, query, { exporting = false } = {}) {
  const d = descriptorFor(actor, type);
  if (query.status && !d.statuses?.includes(query.status)) throw new AppError(422, 'INVALID_STATUS', 'Choose a state supported by this report.');
  if (query.category && !d.categories?.includes(query.category)) throw new AppError(422, 'INVALID_CATEGORY', 'Choose a category supported by this report.');
  const ctx = await context(actor, query, d); const definition = publicDescriptor(type, d);
  const page = query.page || 1; const pageSize = query.pageSize || 20; const limit = exporting ? 10001 : pageSize;
  let data; let total; let summary; let trend;
  if (type === 'financial-results') {
    const rows = jsonValues(await financial(ctx.filter)); total = rows.length;
    summary = { revenue: '0.00', unpaid: '0.00', recordedCost: '0.00', operatingSurplus: '0.00', costsIncomplete: true };
    for (const row of rows) for (const key of ['revenue', 'unpaid', 'recordedCost', 'operatingSurplus']) { row[key] = new Decimal(String(row[key])).toFixed(2); summary[key] = new Decimal(summary[key]).plus(row[key]).toFixed(2); }
    data = exporting ? rows : rows.slice((page - 1) * pageSize, page * pageSize); trend = [...rows].reverse();
  } else {
    const pipeline = [{ $match: { ...ctx.filter, ...(query.status ? { status: query.status } : {}) } }, ...d.stages];
    const project = { ...d.project }; const sums = [...d.sums];
    if (type === 'egg-production' && query.category) { project.selectedEggs = `$data.eggs.${query.category}`; sums.push('selectedEggs'); definition.columns.push({ key: 'selectedEggs', label: `${query.category} count`, unit: 'eggs' }); }
    pipeline.push({ $project: project });
    if (query.category && type !== 'egg-production') pipeline.push({ $match: { category: query.category } });
    const group = { _id: null, ...Object.fromEntries(sums.map((key) => [key, sum(key)])) };
    if (type === 'inventory') group.lowStockPairs = { $sum: { $cond: ['$low', 1, 0] } };
    const dailyGroup = { ...group, _id: '$businessDate' };
    const [result] = await d.model.aggregate([...pipeline, { $facet: {
      rows: [{ $sort: { businessDate: -1, id: 1 } }, ...(exporting ? [] : [{ $skip: (page - 1) * pageSize }]), { $limit: limit }],
      count: [{ $count: 'total' }], summary: [{ $group: group }],
      trend: d.current ? [{ $match: { id: { $exists: false } } }] : [{ $group: dailyGroup }, { $sort: { _id: 1 } }, { $limit: 90 }],
    } }]).option(timeout);
    data = jsonValues(result.rows); total = result.count[0]?.total || 0; summary = jsonValues(result.summary[0] || Object.fromEntries(sums.map((k) => [k, 0])));
    trend = jsonValues(result.trend).map(({ _id, ...row }) => ({ businessDate: _id, ...row })); delete summary._id;
    if (exporting && total > 10000) throw new AppError(422, 'EXPORT_TOO_LARGE', 'This export exceeds 10,000 rows. Narrow the dates or farm filters.');
    if (type === 'bird-weight') {
      const weight = (row) => row.sampleSize ? rounded(new Decimal(row.weightedGrams).dividedBy(row.sampleSize)) : null;
      summary.weightedAverageGrams = weight(summary); for (const row of trend) row.weightedAverageGrams = weight(row);
      delete summary.weightedGrams; for (const row of trend) delete row.weightedGrams; for (const row of data) delete row.weightedGrams;
    }
    const ratios = (row) => {
      if ('mortality' in row && 'openingBirds' in row) row.mortalityPercent = row.openingBirds ? rounded(new Decimal(row.mortality).times(100).dividedBy(row.openingBirds)) : null;
      if ('feedKg' in row && 'openingBirds' in row) row.feedPerBirdG = row.openingBirds ? rounded(new Decimal(row.feedKg).times(1000).dividedBy(row.openingBirds)) : null;
      if ('collectedEggs' in row && 'openingBirds' in row) row.productionPercent = row.openingBirds ? rounded(new Decimal(row.collectedEggs).times(100).dividedBy(row.openingBirds)) : null;
    };
    ratios(summary); trend.forEach(ratios);
    for (const key of ['totalCost', 'postedValue']) if (key in summary) summary[key] = new Decimal(String(summary[key])).toFixed(2);
  }
  return { data, meta: { ...ctx.meta, page, pageSize: exporting ? data.length : pageSize, total, summary, trend, definition, currentState: Boolean(d.current), generatedAt: new Date().toISOString() } };
}
export async function dashboard(actor, query) {
  const ctx = await context(actor, query); const sections = {}; const omitted = [];
  const tasks = [];
  for (const type of ['daily-poultry', 'egg-production', 'mortality', 'bird-weight', 'feed-consumption', 'inventory', 'sales', 'financial-results']) {
    const d = catalog[type]; if (!permitted(actor, d)) continue;
    if (d.farmOnly && (query.houseId || query.flockId)) { omitted.push(`${d.label} is recorded by farm and cannot be attributed to a house/flock.`); continue; }
    tasks.push((async () => { const value = await report(actor, type, { ...query, page: 1, pageSize: 1 }); sections[type] = { summary: value.meta.summary, trend: value.meta.trend, records: value.meta.total, currentState: value.meta.currentState, note: value.meta.definition.note }; })());
  }
  await Promise.all(tasks);
  if (actor.permissions.includes('medication.view')) {
    const now = new Date(); const oldest = new Date(now - 3600000);
    const [row] = await MedicationTask.aggregate([{ $match: { $and: [ctx.scope, { $or: [{ state: 'open' }, { state: { $in: ['completed', 'missed'] }, outcomeBusinessDate: { $gte: ctx.meta.from, $lte: ctx.meta.to } }] }] } }, { $group: { _id: null, scheduled: { $sum: { $cond: [{ $and: [{ $eq: ['$state', 'open'] }, { $gt: ['$dueAt', now] }] }, 1, 0] } }, due: { $sum: { $cond: [{ $and: [{ $eq: ['$state', 'open'] }, { $lte: ['$dueAt', now] }, { $gt: ['$dueAt', oldest] }] }, 1, 0] } }, overdue: { $sum: { $cond: [{ $and: [{ $eq: ['$state', 'open'] }, { $lte: ['$dueAt', oldest] }] }, 1, 0] } }, completed: { $sum: { $cond: [{ $eq: ['$state', 'completed'] }, 1, 0] } }, missed: { $sum: { $cond: [{ $eq: ['$state', 'missed'] }, 1, 0] } } } }]).option(timeout);
    sections.medication = { summary: row ? Object.fromEntries(Object.entries(row).filter(([k]) => k !== '_id')) : { scheduled: 0, due: 0, overdue: 0, completed: 0, missed: 0 }, note: 'Open tasks include all current actionable work. Completed/missed counts use actual-event business dates in the selected window.' };
  }
  if (actor.permissions.includes('inventory.view') && !(query.houseId || query.flockId)) {
    sections.inventory.summary = { lowStockPairs: sections.inventory.summary.lowStockPairs || 0 };
  }
  if (actor.permissions.includes('notifications.view') && !(query.houseId || query.flockId)) {
    const ids = await NotificationRecipient.find({ userId: actor.id }).distinct('notificationId'); let count = 0;
    for await (const row of Notification.find({ ...ctx.scope, _id: { $in: ids }, kind: 'medical', status: { $ne: 'resolved' } }).cursor()) { try { await notificationFor(actor, String(row._id)); count += 1; } catch (e) { if (![403, 404].includes(e.status)) throw e; } }
    sections.emergencies = { summary: { openMedicalAlerts: count }, note: 'Current unresolved medical alerts delivered to your inbox, including older open work.' };
  }
  return { sections, meta: { ...ctx.meta, omitted, standardsConfigured: false, roiAvailable: false } };
}
