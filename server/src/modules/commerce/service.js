import { createHash } from 'node:crypto';
import { EggPolicy, EggPublication, Sale, Expense, ExpenseClaim, CommerceRequest } from './models.js';
import { eggItems } from './setup.js';
import { DailyReport, ReportRevision } from '../reports/models.js';
import { eggKeys } from '../reports/validation.js';
import { InventoryItem, StockLocation, StockBalance, StockMovement, farmScope } from '../inventory/models.js';
import { appendStock, stockLocation, stockDate } from '../inventory/service.js';
import { entity, scopeFilter } from '../organization/service.js';
import { hierarchyModels as H } from '../organization/models.js';
import { Organization } from '../access/models.js';
import { accessTransaction } from '../access/transactions.js';
import { audit } from '../access/audit.js';
import { AppError, notFound, denied } from '../../lib/errors.js';
import { assertVersion } from '../../lib/validation.js';
import { businessDate, allowedDateRange } from '../../policies/dates.js';
import { Decimal } from '../../lib/decimal.js';

const same = (a, b) => String(a) === String(b);
const hash = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function serialize(doc) {
  const convert = (v) => {
    if (v === null || v === undefined) return v;
    if (v._bsontype === 'Decimal128' || v._bsontype === 'ObjectId') return String(v);
    if (v instanceof Date) return v.toISOString();
    if (Array.isArray(v)) return v.map(convert);
    if (typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, child]) => [k === '_id' ? 'id' : k, convert(child)]));
    return v;
  };
  return convert(doc.toObject());
}
async function activeFarm(actor, id, session) {
  const farm = await entity(actor, 'farm', id, session); const site = await H.site.findById(farm.siteId).session(session);
  if (farm.status !== 'active' || site?.status !== 'active') throw new AppError(409, 'ARCHIVED_CONTEXT', 'Restore the farm and site before recording new transactions.');
  return farm;
}
async function window(actor, input, session = null) { const org = await Organization.findById(actor.organizationId).session(session); return allowedDateRange(actor, { from: input.from, to: input.to, timezone: org.timezone }); }
async function today(actor, session) { return businessDate(new Date(), (await Organization.findById(actor.organizationId).session(session)).timezone); }
async function filterFor(actor, query) {
  const filter = await scopeFilter(actor, 'flock'); const range = await window(actor, query);
  if (query.farmId) { await entity(actor, 'farm', query.farmId); filter.farmId = query.farmId; }
  if (query.flockId) { const flock = await entity(actor, 'flock', query.flockId); if (query.farmId && !same(flock.farmId, query.farmId)) throw new AppError(422, 'ANCESTRY_MISMATCH', 'Flock and farm must agree.'); filter.flockId = flock._id; }
  filter.businessDate = { $gte: range.from, $lte: range.to }; return { filter, range };
}
async function recordFor(actor, Model, id, session = null) {
  const row = await Model.findOne({ _id: id, ...await scopeFilter(actor, 'flock', session) }).session(session);
  if (!row) throw notFound(); await stockDate(actor, row.businessDate, session); return row;
}
async function page(Model, filter, query, range = {}) {
  const [rows, total] = await Promise.all([Model.find(filter).sort({ businessDate: -1, _id: -1 }).skip((query.page - 1) * query.pageSize).limit(query.pageSize), Model.countDocuments(filter)]);
  return { data: rows.map(serialize), meta: { ...range, page: query.page, pageSize: query.pageSize, total } };
}
async function replay(actor, key, payload, session) {
  if (!/^[\w-]{16,100}$/.test(key || '')) throw new AppError(422, 'IDEMPOTENCY_REQUIRED', 'Supply a 16-100 character Idempotency-Key.');
  const found = await CommerceRequest.findOne({ actorId: actor.id, key }).session(session);
  if (!found) return null;
  if (found.fingerprint !== hash(payload)) throw new AppError(409, 'IDEMPOTENCY_CONFLICT', 'This key was used for different inputs.');
  return serialize(await recordFor(actor, found.kind === 'sale' ? Sale : Expense, found.recordId, session));
}
async function remember(actor, key, payload, kind, row, session) { await CommerceRequest.create([{ actorId: actor.id, key, fingerprint: hash(payload), kind, recordId: row._id }], { session }); }
export async function policy(actor, farmId) { await entity(actor, 'farm', farmId); const row = await EggPolicy.findOne({ farmId, organizationId: actor.organizationId }); if (!row) throw notFound(); return serialize(row); }
export async function updatePolicy(caller, farmId, input, requestId) {
  return accessTransaction(caller, ['egg-production.manage'], async (session, actor) => {
    await activeFarm(actor, farmId, session); const row = await EggPolicy.findOne({ farmId, organizationId: actor.organizationId }).session(session); if (!row) throw notFound(); assertVersion(row, input.version);
    const location = await stockLocation(actor, input.locationId, session, true);
    if (!same(location.farmId, farmId) || location.kind !== 'collection') throw new AppError(422, 'INVALID_COLLECTION', 'Choose an active collection room in this farm.');
    const before = serialize(row); row.locationId = location._id; row.categories = input.categories; row.version += 1; await row.save({ session });
    await audit(actor, 'eggs.policy-updated', 'egg-policy', row._id, { before, after: serialize(row), reason: input.reason }, requestId, session); return serialize(row);
  });
}
export async function publishEggs(actor, report, revision, reason, session) {
  const existing = await EggPublication.findOne({ reportId: report._id, revision }).session(session); if (existing) return serialize(existing);
  const prior = await EggPublication.findOne({ reportId: report._id }).sort({ revision: -1 }).session(session);
  const config = prior || await EggPolicy.findOne({ farmId: report.farmId, organizationId: actor.organizationId }).session(session);
  if (!config) throw new AppError(409, 'EGG_POLICY_REQUIRED', 'Configure the farm collection room before publication.');
  const location = await stockLocation(actor, String(config.locationId), session, true);
  const catalog = await eggItems(actor.organizationId, session); const items = {}; const counts = {}; const movements = [];
  for (const category of config.categories) {
    const item = prior ? await InventoryItem.findById(prior.items[category]).session(session) : catalog[category];
    if (!item?.active || item.unit !== 'count') throw new AppError(409, 'INVALID_EGG_ITEM', 'Restore the egg-category stock item before publishing.');
    items[category] = String(item._id); counts[category] = report.data.eggs[category] || 0;
    const delta = counts[category] - (prior?.counts[category] || 0);
    if (delta) movements.push(await appendStock(actor, item, location, delta * 1000, { source: 'report', type: 'report-eggs', reportId: report._id, revision, businessDate: report.businessDate, reason: reason || 'Published report egg collection', sourceKey: `report:${report._id}:revision:${revision}:eggs:${category}` }, session));
  }
  const [row] = await EggPublication.create([{ organizationId: report.organizationId, siteId: report.siteId, farmId: report.farmId, reportId: report._id, revision, businessDate: report.businessDate, policyVersion: prior?.policyVersion || config.version, locationId: location._id, categories: [...config.categories], counts, items, movementIds: movements.map((m) => m._id) }], { session });
  return serialize(row);
}
export async function backfill(caller, id, input, requestId) {
  return accessTransaction(caller, ['egg-production.manage', 'daily-reports.review', 'reports.history.view'], async (session, actor) => {
    const report = await recordFor(actor, DailyReport, id, session); if (!report.publishedRevision) throw new AppError(409, 'NOT_PUBLISHED', 'Only published report evidence can initialize egg stock.');
    await activeFarm(actor, report.farmId, session);
    const snapshot = await ReportRevision.findOne({ reportId: id, number: report.publishedRevision }).session(session);
    const result = await publishEggs(actor, { ...report.toObject(), data: snapshot.data }, report.publishedRevision, input.reason, session);
    await audit(actor, 'eggs.legacy-published', 'daily-report', id, { publicationId: result.id, reason: input.reason }, requestId, session); return result;
  });
}
export async function production(actor, query) {
  const { filter, range } = await filterFor(actor, query); filter.publishedRevision = { $gt: 0 };
  const result = await page(DailyReport, filter, query, range); const data = [];
  for (const row of result.data) {
    const revision = await ReportRevision.findOne({ reportId: row.id, number: row.publishedRevision });
    const posting = await EggPublication.findOne({ reportId: row.id, revision: row.publishedRevision });
    data.push({ id: row.id, farmId: row.farmId, houseId: row.houseId, flockId: row.flockId, businessDate: row.businessDate, revision: row.publishedRevision, eggs: revision.data.eggs, totalEggs: revision.summary.totalEggs, feedKg: revision.summary.feedKg, posting: posting ? serialize(posting) : null, saleableEggs: posting ? Object.values(posting.counts).reduce((a, b) => a + b, 0) : null });
  }
  return { data, meta: result.meta };
}
export async function eggStock(actor, farmId) {
  await entity(actor, 'farm', farmId); const config = await policy(actor, farmId);
  const locations = await StockLocation.find({ ...await scopeFilter(actor, 'flock'), farmId, kind: 'collection', active: true });
  const items = await InventoryItem.find({ organizationId: actor.organizationId, eggCategory: { $in: config.categories }, active: true });
  const data = [];
  for (const location of locations) for (const item of items) {
    const balance = await StockBalance.findOne({ locationId: location._id, itemId: item._id });
    data.push({ id: `${location._id}:${item._id}`, locationId: String(location._id), locationName: location.name, category: item.eggCategory, eggs: (balance?.amount || 0) / 1000, petiEquivalent: new Decimal(balance?.amount || 0).div(1000).div(360).toFixed(3) });
  }
  return { data, meta: { total: data.length }, policy: config };
}
export async function listSales(actor, query) { const { filter, range } = await filterFor(actor, query); if (query.status) filter.status = query.status; return page(Sale, filter, query, range); }
export async function saleDetail(actor, id) { const row = await recordFor(actor, Sale, id); return { ...serialize(row), movements: (await StockMovement.find({ saleId: id }).sort({ _id: 1 })).map(serialize) }; }
export async function createSale(caller, input, key, requestId) {
  return accessTransaction(caller, ['sales.manage'], async (session, actor) => {
    const cached = await replay(actor, key, { sale: input }, session); if (cached) return cached;
    const farm = await activeFarm(actor, input.farmId, session); await stockDate(actor, input.businessDate, session);
    const location = await stockLocation(actor, input.locationId, session, true);
    if (!same(location.farmId, farm._id) || location.kind !== 'collection') throw new AppError(422, 'INVALID_COLLECTION', 'Choose a collection room belonging to the sale farm.');
    const config = await EggPolicy.findOne({ farmId: farm._id }).session(session); const catalog = await eggItems(actor.organizationId, session);
    const lines = input.lines.map((line) => {
      if (!config.categories.includes(line.category)) throw new AppError(422, 'UNSALEABLE_CATEGORY', 'This category is not saleable under the farm policy.');
      return { ...line, itemId: catalog[line.category]._id, eggs: line.quantity * (line.unit === 'peti' ? 360 : 1), unitPrice: new Decimal(line.unitPrice).toFixed(2), amount: new Decimal(line.unitPrice).times(line.quantity).toFixed(2) };
    });
    const total = lines.reduce((sum, l) => sum.plus(l.amount), new Decimal(0)).toFixed(2);
    const [sale] = await Sale.create([{ ...farmScope(farm), businessDate: input.businessDate, locationId: location._id, buyer: input.buyer, reference: input.reference, paymentStatus: input.paymentStatus, lines, total, totalEggs: lines.reduce((sum, l) => sum + l.eggs, 0), createdBy: actor.id, createdByName: actor.name }], { session });
    for (const line of lines) await appendStock(actor, catalog[line.category], location, -line.eggs * 1000, { source: 'sale', type: 'sale-issue', saleId: sale._id, businessDate: input.businessDate, reason: 'Posted egg sale', sourceKey: `sale:${sale._id}:line:${line.key}` }, session);
    await remember(actor, key, { sale: input }, 'sale', sale, session); await audit(actor, 'sale.posted', 'sale', sale._id, { eggs: sale.totalEggs }, requestId, session); return serialize(sale);
  }, { companyOnly: false });
}
export async function saleAction(caller, id, input, action, requestId) {
  return accessTransaction(caller, ['sales.manage'], async (session, actor) => {
    const sale = await recordFor(actor, Sale, id, session); assertVersion(sale, input.version); await activeFarm(actor, sale.farmId, session);
    if (sale.status !== 'posted') throw new AppError(409, 'SALE_CANCELLED', 'Cancelled sales cannot be changed.');
    if (action === 'payment') sale.paymentStatus = input.paymentStatus;
    if (action === 'dispatch') { if (sale.dispatchStatus !== 'ready') throw new AppError(409, 'ALREADY_DISPATCHED', 'This sale is already dispatched.'); sale.dispatchStatus = 'dispatched'; sale.dispatchedAt = new Date(); }
    if (action === 'cancel') {
      if (sale.dispatchStatus !== 'ready') throw new AppError(409, 'DISPATCHED_SALE', 'Only sales awaiting physical dispatch can be cancelled. Customer returns are outside this phase.');
      const location = await stockLocation(actor, String(sale.locationId), session, true); const date = await today(actor, session);
      for (const line of sale.lines) await appendStock(actor, await InventoryItem.findById(line.itemId).session(session), location, line.eggs * 1000, { source: 'sale', type: 'sale-cancellation', saleId: sale._id, businessDate: date, reason: input.reason, sourceKey: `sale:${id}:cancel:${line.key}` }, session);
      sale.status = 'cancelled'; sale.cancelReason = input.reason; sale.cancelledAt = new Date(); sale.cancelledBy = actor.id;
    }
    sale.version += 1; await sale.save({ session });
    await audit(actor, `sale.${action}`, 'sale', id, { paymentStatus: sale.paymentStatus, status: sale.status, reason: input.reason || '' }, requestId, session); return serialize(sale);
  }, { companyOnly: false });
}
export async function listExpenses(actor, query) { const { filter, range } = await filterFor(actor, query); if (query.status) filter.status = query.status; return page(Expense, filter, query, range); }
export async function expenseDetail(actor, id) { return serialize(await recordFor(actor, Expense, id)); }
async function writeExpense(actor, input, session, replaces = null) {
  const farm = await activeFarm(actor, input.farmId, session); await stockDate(actor, input.businessDate, session);
  if (replaces && !same(replaces.farmId, farm._id)) throw new AppError(422, 'IMMUTABLE_FARM', 'Replacement expenses must stay in the original farm.');
  const keys = [];
  if (input.reference) keys.push(`reference:${input.reference.normalize('NFKC').toLowerCase()}`);
  if (input.sourceMovementId) {
    if (!actor.permissions.includes('inventory.view')) throw denied();
    const source = await recordFor(actor, StockMovement, input.sourceMovementId, session);
    if (!same(source.farmId, farm._id) || source.source !== 'manual' || !['receipt', 'opening'].includes(source.type)) throw new AppError(422, 'INVALID_EXPENSE_SOURCE', 'Link an accessible receipt/opening from this farm.');
    keys.push(`movement:${source._id}`);
  }
  const [expense] = await Expense.create([{ ...farmScope(farm), ...input, amount: new Decimal(input.amount).toFixed(2), replacesId: replaces?._id, createdBy: actor.id, createdByName: actor.name }], { session });
  for (const key of keys) {
    const found = await ExpenseClaim.findOne({ organizationId: actor.organizationId, farmId: farm._id, key }).session(session);
    if (found) {
      if (!replaces || !same(found.expenseId, replaces._id)) throw new AppError(409, 'EXPENSE_SOURCE_BOOKED', 'This expense source/reference is already booked. Correct it through void-and-replacement.');
      found.expenseId = expense._id; await found.save({ session });
    } else await ExpenseClaim.create([{ organizationId: actor.organizationId, farmId: farm._id, key, expenseId: expense._id }], { session });
  }
  return expense;
}
export async function createExpense(caller, input, key, requestId) {
  return accessTransaction(caller, ['finance.manage'], async (session, actor) => {
    const previous = await replay(actor, key, { expense: input }, session); if (previous) return previous;
    const expense = await writeExpense(actor, input, session); await remember(actor, key, { expense: input }, 'expense', expense, session);
    await audit(actor, 'expense.created', 'expense', expense._id, { category: expense.category }, requestId, session); return serialize(expense);
  }, { companyOnly: false });
}
export async function expenseAction(caller, id, input, action, key, requestId) {
  return accessTransaction(caller, ['finance.manage'], async (session, actor) => {
    const payload = { id, action, ...input }; if (action === 'replace') { const prior = await replay(actor, key, payload, session); if (prior) return prior; }
    const old = await recordFor(actor, Expense, id, session); assertVersion(old, input.version); await activeFarm(actor, old.farmId, session);
    if (old.status !== 'active') throw new AppError(409, 'EXPENSE_VOIDED', 'Only active expenses can be voided or replaced.');
    let replacement;
    if (action === 'replace') { replacement = await writeExpense(actor, input.expense, session, old); old.replacementId = replacement._id; await remember(actor, key, payload, 'expense', replacement, session); }
    old.status = 'voided'; old.voidReason = input.reason; old.voidedAt = new Date(); old.voidedBy = actor.id; old.version += 1; await old.save({ session });
    await audit(actor, `expense.${action}`, 'expense', id, { reason: input.reason, replacementId: replacement ? String(replacement._id) : null }, requestId, session); return serialize(replacement || old);
  }, { companyOnly: false });
}
export async function finance(actor, query) {
  const { filter, range } = await filterFor(actor, query);
  const [sales, expenses] = await Promise.all([Sale.find({ ...filter, status: 'posted' }).select('businessDate total paymentStatus'), Expense.find({ ...filter, status: 'active' }).select('businessDate amount')]);
  const groups = new Map();
  const group = (date) => { if (!groups.has(date)) groups.set(date, { businessDate: date, revenue: new Decimal(0), unpaid: new Decimal(0), recordedCost: new Decimal(0), saleCount: 0, expenseCount: 0 }); return groups.get(date); };
  for (const sale of sales) { const g = group(sale.businessDate); g.revenue = g.revenue.plus(String(sale.total)); if (sale.paymentStatus === 'pending') g.unpaid = g.unpaid.plus(String(sale.total)); g.saleCount += 1; }
  for (const expense of expenses) { const g = group(expense.businessDate); g.recordedCost = g.recordedCost.plus(String(expense.amount)); g.expenseCount += 1; }
  const rows = [...groups.values()].sort((a, b) => b.businessDate.localeCompare(a.businessDate));
  const totals = { revenue: '0.00', unpaid: '0.00', recordedCost: '0.00', operatingSurplus: '0.00', costsIncomplete: true };
  const data = rows.map((g) => { const row = { id: g.businessDate, ...g, operatingSurplus: g.revenue.minus(g.recordedCost).toFixed(2), costsIncomplete: true }; for (const k of ['revenue', 'unpaid', 'recordedCost']) { row[k] = g[k].toFixed(2); totals[k] = new Decimal(totals[k]).plus(row[k]).toFixed(2); } return row; });
  totals.operatingSurplus = new Decimal(totals.revenue).minus(totals.recordedCost).toFixed(2);
  return { data, meta: { ...range, totals, total: data.length, note: 'Recorded sales-date revenue, regardless of payment status. Cost completeness is unconfirmed; this is not cash flow, official profit, or ROI.' } };
}
export async function sources(actor, query) {
  const { filter, range } = await filterFor(actor, query); const result = await page(query.kind === 'sales' ? Sale : Expense, filter, query, range);
  result.data = result.data.map((r) => ({ id: r.id, farmId: r.farmId, businessDate: r.businessDate, status: r.status, amount: r.total || r.amount, kind: query.kind })); return result;
}
