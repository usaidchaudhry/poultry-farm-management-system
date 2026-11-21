import { createHash } from 'node:crypto';
import { FeedFormula as Formula, FormulaVersion as V, FormulaPricing as Pricing, FormulaSnapshot as Snapshot, FormulaRequest as Request } from './models.js';
import { InventoryItem } from '../inventory/models.js';
import { hierarchyModels as H } from '../organization/models.js';
import { Organization } from '../access/models.js';
import { entity, scopeFilter } from '../organization/service.js';
import { accessTransaction } from '../access/transactions.js';
import { audit } from '../access/audit.js';
import { AppError, notFound } from '../../lib/errors.js';
import { assertVersion } from '../../lib/validation.js';
import { allowedDateRange } from '../../policies/dates.js';
import { Decimal } from '../../lib/decimal.js';

const policy = 'formula-v1:decimal28:half-up:row-money2:sum-rounded-rows:kg3:rate4:per-kg4:bag-from-unrounded-ratio2';
const sumKg = (rows) => rows.reduce((sum, r) => sum.plus(String(r.kg)), new Decimal(0)).toFixed(3);
async function window(actor, query, session = null) { const org = await Organization.findById(actor.organizationId).session(session); return allowedDateRange(actor, { from: query.from, to: query.to, timezone: org.timezone }); }
async function dateCheck(actor, date, session) { await window(actor, { from: date, to: date }, session); }
async function activeFarm(actor, id, session) {
  const farm = await entity(actor, 'farm', id, session);
  const site = await H.site.findById(farm.siteId).session(session);
  if (farm.status !== 'active' || site?.status !== 'active') throw new AppError(409, 'ARCHIVED_CONTEXT', 'Restore the farm and site before changing a formula.');
  return farm;
}
async function recordFor(actor, id, session = null, pendingException = true) {
  const record = await V.findOne({ _id: id, ...await scopeFilter(actor, 'flock', session) }).session(session);
  if (!record) throw notFound();
  if (!pendingException || record.status !== 'pending_costing') await dateCheck(actor, record.businessDate, session);
  return record;
}
function compositionFields(record) {
  return { id: String(record._id), organizationId: String(record.organizationId), siteId: String(record.siteId), farmId: String(record.farmId), formulaId: String(record.formulaId), number: record.number, previousVersionId: record.previousVersionId ? String(record.previousVersionId) : null, name: record.name, businessDate: record.businessDate, feedType: record.feedType, strain: record.strain, bagSizeKg: String(record.bagSizeKg), rows: record.rows.map((r) => ({ key: r.key, itemId: String(r.itemId), itemName: r.itemName, kg: String(r.kg) })), totalKg: String(record.totalKg), status: record.status, version: record.version, returnReason: record.returnReason || '', revisionReason: record.revisionReason || '', createdBy: String(record.createdBy), createdByName: record.createdByName, createdAt: record.createdAt, finalizedByName: record.finalizedByName, finalizedAt: record.finalizedAt };
}
export function calculateCost(record, rates) {
  if (rates.length !== record.rows.length || new Set(rates.map((r) => r.key)).size !== rates.length || rates.some((r) => !record.rows.some((row) => row.key === r.key))) throw new AppError(422, 'INVALID_RATES', 'Enter exactly one positive rate for every ingredient row.');
  const rows = record.rows.map((r) => { const rate = new Decimal(String(rates.find((p) => p.key === r.key).rate)); return { key: r.key, itemId: String(r.itemId), itemName: r.itemName, kg: String(r.kg), rate: rate.toFixed(4), cost: new Decimal(String(r.kg)).times(rate).toFixed(2) }; });
  const totalKg = sumKg(rows); const total = rows.reduce((sum, r) => sum.plus(r.cost), new Decimal(0));
  const ratio = total.div(totalKg);
  return { currency: 'PKR', policy, rows, totalKg, totalCost: total.toFixed(2), costPerKg: ratio.toFixed(4), costPerBag: ratio.times(String(record.bagSizeKg)).toFixed(2), bagSizeKg: String(record.bagSizeKg) };
}
async function present(actor, record, session = null) {
  // Explicit allowlist: no pricing/snapshot fields can leak into composition reads.
  const row = compositionFields(record); const logical = await Formula.findById(record.formulaId).session(session);
  row.code = logical.code; row.archived = logical.archived; row.latest = String(logical.latestVersionId) === row.id;
  if (actor.permissions.includes('feed-formulas.cost-view')) {
    const prices = await Pricing.findOne({ versionId: record._id }).session(session);
    const frozen = await Snapshot.findOne({ versionId: record._id }).session(session);
    if (frozen) row.costing = { currency: frozen.currency, policy: frozen.policy, rows: frozen.rows.map((r) => ({ key: r.key, itemId: String(r.itemId), itemName: r.itemName, kg: String(r.kg), rate: String(r.rate), cost: String(r.cost) })), totalKg: String(frozen.totalKg), bagSizeKg: String(frozen.bagSizeKg), totalCost: String(frozen.totalCost), costPerKg: String(frozen.costPerKg), costPerBag: String(frozen.costPerBag) };
    else if (prices) row.costing = calculateCost(record, prices.rates);
  }
  return row;
}
export async function list(actor, query) {
  const filter = await scopeFilter(actor, 'flock');
  if (query.farmId) { await entity(actor, 'farm', query.farmId); filter.farmId = query.farmId; }
  const logicalFilter = { ...filter, archived: query.archived === 'true', ...(query.formulaId ? { _id: query.formulaId } : {}) };
  const formulas = await Formula.find(logicalFilter).select('_id'); filter.formulaId = { $in: formulas.map((r) => r._id) };
  let range = {};
  if (query.view === 'pending') {
    if (query.from || query.to || (query.status && query.status !== 'pending_costing')) throw new AppError(422, 'INVALID_PENDING_FILTER', 'Pending handoffs use current workflow state, without history date filters.');
    filter.status = 'pending_costing';
  } else { range = await window(actor, query); filter.businessDate = { $gte: range.from, $lte: range.to }; if (query.status) filter.status = query.status; }
  const [records, total] = await Promise.all([V.find(filter).sort({ businessDate: -1, _id: -1 }).skip((query.page - 1) * query.pageSize).limit(query.pageSize), V.countDocuments(filter)]);
  const data = []; for (const r of records) data.push(await present(actor, r));
  return { data, meta: { ...range, page: query.page, pageSize: query.pageSize, total } };
}
export async function detail(actor, id) {
  const record = await recordFor(actor, id);
  const result = await present(actor, record); const range = await window(actor, {});
  // History controls remain effective even while an old pending handoff is actionable.
  const earliest = actor.permissions.includes('reports.history.view') ? new Date(Date.parse(range.to) - 89 * 86400000).toISOString().slice(0, 10) : range.from;
  const history = await V.find({ formulaId: record.formulaId, ...await scopeFilter(actor, 'flock'), businessDate: { $gte: earliest, $lte: range.to } }).sort({ number: -1 }).limit(100);
  result.history = history.map((r) => ({ id: String(r._id), number: r.number, status: r.status, businessDate: r.businessDate }));
  return result;
}
async function validatedComposition(actor, input, session) {
  await dateCheck(actor, input.businessDate, session);
  const rows = [];
  for (const row of input.rows) {
    const item = await InventoryItem.findOne({ _id: row.itemId, organizationId: actor.organizationId, active: true, category: 'ingredient', unit: 'kg' }).session(session);
    if (!item) throw new AppError(422, 'INVALID_INGREDIENT', 'Choose an active kg ingredient from the catalog for every row.');
    rows.push({ ...row, itemName: item.name, kg: new Decimal(row.kg).toFixed(3) });
  }
  return { name: input.name, businessDate: input.businessDate, feedType: input.feedType, strain: input.strain, bagSizeKg: new Decimal(input.bagSizeKg).toFixed(3), rows, totalKg: sumKg(rows) };
}
function requestHash(value) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
async function replay(actor, key, payload, session) {
  if (!/^[\w-]{16,100}$/.test(key || '')) throw new AppError(422, 'IDEMPOTENCY_REQUIRED', 'Supply a 16-100 character Idempotency-Key.');
  const existing = await Request.findOne({ actorId: actor.id, key }).session(session);
  if (!existing) return null;
  if (existing.fingerprint !== requestHash(payload)) throw new AppError(409, 'IDEMPOTENCY_CONFLICT', 'This key was used with different inputs.');
  return present(actor, await recordFor(actor, existing.versionId, session), session);
}
async function remember(actor, key, payload, record, session) { await Request.create([{ actorId: actor.id, key, fingerprint: requestHash(payload), versionId: record._id }], { session }); }
async function assertEditable(actor, record, session, status) {
  const logical = await Formula.findById(record.formulaId).session(session);
  if (logical.archived || String(logical.latestVersionId) !== String(record._id) || !status.includes(record.status)) throw new AppError(409, 'FORMULA_LOCKED', 'This formula version is locked. Refresh or create a new draft from its latest finalized version.');
  await activeFarm(actor, record.farmId, session); return logical;
}
export async function save(caller, id, input, key, requestId) {
  return accessTransaction(caller, ['feed-formulas.compose'], async (session, actor) => {
    if (!id) { const prior = await replay(actor, key, input, session); if (prior) return prior; }
    const record = id ? await recordFor(actor, id, session, false) : null;
    if (record) { assertVersion(record, input.version); await assertEditable(actor, record, session, ['draft', 'returned']); }
    const farm = await activeFarm(actor, record?.farmId || input.farmId, session);
    const values = await validatedComposition(actor, input, session);
    let logical;
    if (!record) [logical] = await Formula.create([{ organizationId: actor.organizationId, siteId: farm.siteId, farmId: farm._id, code: input.code, codeKey: input.code.normalize('NFKC').toLowerCase(), latestNumber: 1 }], { session });
    const target = record || new V({ organizationId: actor.organizationId, siteId: farm.siteId, farmId: farm._id, formulaId: logical._id, number: 1, createdBy: actor.id, createdByName: actor.name });
    Object.assign(target, values); if (record) target.version += 1; await target.save({ session });
    if (!record) { logical.latestVersionId = target._id; await logical.save({ session }); await remember(actor, key, input, target, session); }
    await audit(actor, record ? 'formula.composition-updated' : 'formula.created', 'formula-version', target._id, { formulaId: String(target.formulaId), number: target.number, status: target.status }, requestId, session);
    return present(actor, target, session);
  }, { companyOnly: false });
}
export async function preview(actor, id, input) {
  const record = await recordFor(actor, id); assertVersion(record, input.version);
  await assertEditable(actor, record, null, ['pending_costing']); return calculateCost(record, input.rates);
}
export async function transition(caller, id, input, action, key, requestId) {
  const grants = { submit: ['feed-formulas.submit'], pricing: ['feed-formulas.cost', 'feed-formulas.cost-view'], finalize: ['feed-formulas.finalize', 'feed-formulas.cost-view'], return: ['feed-formulas.return'], revise: ['feed-formulas.compose'], archive: ['feed-formulas.compose'] };
  return accessTransaction(caller, grants[action], async (session, actor) => {
    const payload = { id, action, ...input };
    if (action === 'revise') { const prior = await replay(actor, key, payload, session); if (prior) return prior; }
    const record = await recordFor(actor, id, session, !['revise', 'archive', 'submit'].includes(action)); assertVersion(record, input.version);
    const logical = await assertEditable(actor, record, session, ['submit'].includes(action) ? ['draft', 'returned'] : ['revise', 'archive'].includes(action) ? ['finalized'] : ['pending_costing']);
    let target = record;
    if (action === 'submit') {
      // Revalidate catalog/context at the handoff, after any draft edit or deactivation.
      await validatedComposition(actor, compositionFields(record), session);
      record.status = 'pending_costing'; record.returnReason = ''; record.submittedBy = actor.id;
    }
    if (action === 'pricing') {
      calculateCost(record, input.rates);
      await Pricing.findOneAndUpdate({ versionId: id }, { $set: { rates: input.rates, updatedBy: actor.id } }, { upsert: true, session });
    }
    if (action === 'return') { record.status = 'returned'; record.returnReason = input.reason; await Pricing.deleteOne({ versionId: id }, { session }); }
    if (action === 'finalize') {
      const pricing = await Pricing.findOne({ versionId: id }).session(session);
      if (!pricing) throw new AppError(422, 'RATES_REQUIRED', 'Save a positive rate for every ingredient before finalization.');
      const costing = calculateCost(record, pricing.rates); const finalizedAt = new Date();
      await Snapshot.create([{ organizationId: record.organizationId, siteId: record.siteId, farmId: record.farmId, versionId: id, formulaId: logical._id, number: record.number, code: logical.code, name: record.name, businessDate: record.businessDate, feedType: record.feedType, strain: record.strain, ...costing, finalizedBy: actor.id, finalizedByName: actor.name, finalizedAt }], { session });
      record.status = 'finalized'; record.finalizedBy = actor.id; record.finalizedByName = actor.name; record.finalizedAt = finalizedAt;
    }
    if (action === 'revise') {
      const values = await validatedComposition(actor, { ...compositionFields(record), businessDate: input.businessDate }, session);
      [target] = await V.create([{ organizationId: record.organizationId, siteId: record.siteId, farmId: record.farmId, formulaId: logical._id, number: logical.latestNumber + 1, previousVersionId: record._id, ...values, revisionReason: input.reason, createdBy: actor.id, createdByName: actor.name }], { session });
      logical.latestNumber += 1; logical.latestVersionId = target._id; logical.version += 1; await logical.save({ session }); await remember(actor, key, payload, target, session);
    } else if (action === 'archive') { logical.archived = true; logical.version += 1; await logical.save({ session }); }
    else { record.version += 1; await record.save({ session }); }
    // Audit records intentionally contain state/identities, never rates or costs.
    await audit(actor, `formula.${action}`, 'formula-version', target._id, { formulaId: String(logical._id), number: target.number, status: target.status, reason: input.reason || '', previousVersionId: action === 'revise' ? id : undefined }, requestId, session);
    return present(actor, target, session);
  }, { companyOnly: false });
}
export async function ingredients(actor, query) {
  const filter = { organizationId: actor.organizationId, active: true, category: 'ingredient', unit: 'kg' };
  const [rows, total] = await Promise.all([InventoryItem.find(filter).sort({ name: 1 }).skip((query.page - 1) * query.pageSize).limit(query.pageSize), InventoryItem.countDocuments(filter)]);
  return { data: rows.map((r) => ({ id: String(r._id), name: r.name, unit: r.unit })), meta: { page: query.page, pageSize: query.pageSize, total } };
}
