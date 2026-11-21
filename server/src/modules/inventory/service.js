import { createHash } from 'node:crypto';
import { InventoryItem as Item, StockLocation as Location, StockBalance as Balance, StockMovement as Movement, StockOperation as Operation, FeedPublication, farmScope } from './models.js';
import { Organization } from '../access/models.js';
import { hierarchyModels as H } from '../organization/models.js';
import { entity, scopeFilter } from '../organization/service.js';
import { accessTransaction } from '../access/transactions.js';
import { audit } from '../access/audit.js';
import { AppError, denied, notFound } from '../../lib/errors.js';
import { assertVersion } from '../../lib/validation.js';
import { allowedDateRange } from '../../policies/dates.js';
import { Decimal } from '../../lib/decimal.js';

// Integer thousandths avoid floating point accumulation. All totals remain safe integers.
const scaled = (v) => Number(new Decimal(v).times(1000).toDecimalPlaces(0));
const nameKey = (v) => v.normalize('NFKC').toLowerCase();
const equal = (a, b) => String(a) === String(b);
export function serialize(doc) {
  const { _id, nameKey: ignored, ...row } = doc.toObject();
  for (const key of Object.keys(row)) if ((key.endsWith('Id') || key.endsWith('By')) && row[key]) row[key] = String(row[key]);
  if (row.amount !== undefined) { row.quantity = row.amount / 1000; delete row.amount; }
  if (row.minimum !== undefined) row.minimum /= 1000;
  return { id: String(_id), ...row };
}
async function range(actor, query, session = null) {
  const org = await Organization.findById(actor.organizationId).session(session);
  return allowedDateRange(actor, { from: query.from, to: query.to, timezone: org.timezone });
}
async function dateCheck(actor, date, session) { await range(actor, { from: date, to: date }, session); }
async function activeFarm(actor, id, session) {
  const farm = await entity(actor, 'farm', id, session);
  const site = await H.site.findById(farm.siteId).session(session);
  if (farm.status !== 'active' || site?.status !== 'active') throw new AppError(409, 'ARCHIVED_CONTEXT', 'Restore the farm and site before changing stock.');
  return farm;
}
async function itemFor(actor, id, session, active = false) {
  if (!/^[a-f\d]{24}$/i.test(id || '')) throw new AppError(422, 'INVALID_FEED_REFERENCE', 'Choose a real catalog item and stock location.');
  const item = await Item.findOne({ _id: id, organizationId: actor.organizationId }).session(session);
  if (!item) throw notFound();
  if (active && !item.active) throw new AppError(409, 'INACTIVE_ITEM', 'Activate the stock item first.');
  return item;
}
async function locationFor(actor, id, session, active = false) {
  if (!/^[a-f\d]{24}$/i.test(id || '')) throw new AppError(422, 'INVALID_FEED_REFERENCE', 'Choose a real stock location in this farm.');
  const row = await Location.findOne({ _id: id, ...await scopeFilter(actor, 'flock', session) }).session(session);
  if (!row) throw notFound();
  if (active) { await activeFarm(actor, row.farmId, session); if (!row.active) throw new AppError(409, 'INACTIVE_LOCATION', 'Activate the stock location first.'); }
  return row;
}
async function scoped(actor, query, session = null) {
  const filter = await scopeFilter(actor, 'flock', session);
  if (query.farmId) { await entity(actor, 'farm', query.farmId, session); filter.farmId = query.farmId; }
  if (query.locationId) {
    const location = await locationFor(actor, query.locationId, session);
    if (query.farmId && !equal(location.farmId, query.farmId)) throw new AppError(422, 'ANCESTRY_MISMATCH', 'Location and farm must agree.');
    filter.locationId = location._id;
  }
  if (query.itemId) { await itemFor(actor, query.itemId, session); filter.itemId = query.itemId; }
  return filter;
}
async function page(Model, filter, query, sort = { _id: -1 }) {
  const [rows, total] = await Promise.all([Model.find(filter).sort(sort).skip((query.page - 1) * query.pageSize).limit(query.pageSize), Model.countDocuments(filter)]);
  return { data: rows.map(serialize), meta: { page: query.page, pageSize: query.pageSize, total } };
}
export async function list(actor, kind, query) {
  if (kind === 'items') return page(Item, { organizationId: actor.organizationId, ...(query.itemId ? { _id: query.itemId } : {}), ...(query.category ? { category: query.category } : {}), ...(query.active ? { active: query.active === 'true' } : {}) }, query, { name: 1 });
  const filter = await scoped(actor, query);
  if (kind === 'locations') {
    delete filter.locationId; delete filter.itemId;
    if (query.locationId) filter._id = query.locationId;
    if (query.active) filter.active = query.active === 'true';
    return page(Location, filter, query, { name: 1 });
  }
  if (query.category) filter.itemId = { $in: (await Item.find({ organizationId: actor.organizationId, category: query.category, ...(query.itemId ? { _id: query.itemId } : {}) }).select('_id')).map((r) => r._id) };
  if (kind === 'movements') {
    const window = await range(actor, query); filter.businessDate = { $gte: window.from, $lte: window.to };
    const result = await page(Movement, filter, query, { businessDate: -1, _id: -1 }); return { ...result, meta: { ...result.meta, ...window } };
  }
  if (query.low === 'true') filter.$expr = { $lte: ['$amount', '$minimum'] };
  const result = await page(Balance, filter, query);
  for (const row of result.data) {
    const [item, location] = await Promise.all([Item.findById(row.itemId), Location.findById(row.locationId)]);
    row.itemName = item.name; row.unit = item.unit; row.locationName = location.name; row.low = row.quantity <= row.minimum;
  }
  return result;
}
export async function saveItem(caller, id, input, requestId) {
  return accessTransaction(caller, ['inventory.manage'], async (session, actor) => {
    const item = id ? await itemFor(actor, id, session) : new Item({ organizationId: actor.organizationId });
    if (id) {
      assertVersion(item, input.version);
      const used = await Movement.exists({ itemId: id }).session(session);
      if (used && (item.unit !== input.unit || item.category !== input.category)) throw new AppError(409, 'CATALOG_LOCKED', 'Unit and category cannot change after stock has been posted.');
      if (!input.active && await Balance.exists({ itemId: id, amount: { $ne: 0 } }).session(session)) throw new AppError(409, 'STOCK_REMAINS', 'Clear all location balances before deactivating the item.');
      // Assigned users may create shared catalog entries, but only company scope can change existing shared definitions.
      if (actor.scopeMode !== 'company') throw new AppError(403, 'COMPANY_SCOPE_REQUIRED', 'A company-scope inventory manager must edit shared catalog definitions.');
      item.version += 1;
    }
    if ((['feed', 'ingredient'].includes(input.category) && input.unit !== 'kg') || (input.category === 'egg' && input.unit !== 'count')) throw new AppError(422, 'UNSUPPORTED_UNIT', 'Feed/ingredients use kg and eggs use whole counts.');
    const { version, ...values } = input;
    Object.assign(item, values, { nameKey: nameKey(input.name) }); await item.save({ session });
    await audit(actor, 'inventory.item-saved', 'inventory-item', item._id, { after: serialize(item) }, requestId, session);
    return serialize(item);
  }, { companyOnly: false });
}
export async function saveLocation(caller, id, input, requestId) {
  return accessTransaction(caller, ['inventory.manage'], async (session, actor) => {
    const row = id ? await locationFor(actor, id, session) : new Location({ ...farmScope(await activeFarm(actor, input.farmId, session)), kind: input.kind });
    if (id) {
      await activeFarm(actor, row.farmId, session);
      assertVersion(row, input.version);
      if (!input.active && await Balance.exists({ locationId: id, amount: { $ne: 0 } }).session(session)) throw new AppError(409, 'STOCK_REMAINS', 'Clear the location before deactivating it.');
      row.version += 1; row.active = input.active;
    }
    row.name = input.name; row.nameKey = nameKey(input.name); await row.save({ session });
    await audit(actor, 'inventory.location-saved', 'stock-location', row._id, { after: serialize(row) }, requestId, session);
    return serialize(row);
  }, { companyOnly: false });
}
async function ensureBalance(item, location, session) {
  return Balance.findOneAndUpdate({ itemId: item._id, locationId: location._id }, { $setOnInsert: { organizationId: location.organizationId, siteId: location.siteId, farmId: location.farmId, amount: 0, minimum: 0, version: 1 } }, { upsert: true, returnDocument: 'after', session });
}
export async function setThreshold(caller, input, requestId) {
  return accessTransaction(caller, ['inventory.manage'], async (session, actor) => {
    const item = await itemFor(actor, input.itemId, session, true); const location = await locationFor(actor, input.locationId, session, true);
    if (item.unit === 'count' && !Number.isInteger(input.minimum)) throw new AppError(422, 'UNSUPPORTED_UNIT', 'Counts must be whole numbers.');
    const row = await ensureBalance(item, location, session); assertVersion(row, input.version);
    row.minimum = scaled(input.minimum); row.version += 1; await row.save({ session });
    await audit(actor, 'inventory.threshold-set', 'stock-balance', row._id, { after: serialize(row) }, requestId, session); return serialize(row);
  }, { companyOnly: false });
}
// All callers hold the serialized access transaction. Recheck the entire effective-date
// running ledger as well as conditionally updating the cached present balance.
async function append(actor, item, location, value, fields, session) {
  if (!Number.isSafeInteger(value) || (item.unit === 'count' && value % 1000 !== 0)) throw new AppError(422, 'UNSUPPORTED_UNIT', 'Use canonical units, whole counts, and at most three decimal places.');
  const row = await ensureBalance(item, location, session);
  const movements = await Movement.find({ itemId: item._id, locationId: location._id }).sort({ businessDate: 1, _id: 1 }).session(session);
  const total = movements.reduce((sum, m) => sum + m.amount, 0);
  if (total !== row.amount) throw new AppError(409, 'STOCK_RECONCILIATION_REQUIRED', 'Cached stock differs from its ledger. Resolve this discrepancy before posting.');
  let running = 0; let inserted = false;
  for (const movement of movements) {
    if (!inserted && movement.businessDate > fields.businessDate) { running += value; inserted = true; if (running < 0) throw insufficient(); }
    running += movement.amount;
    if (running < 0) throw insufficient();
  }
  if (!inserted) running += value;
  if (running < 0) throw insufficient();
  if (!Number.isSafeInteger(running) || running > 1e12) throw new AppError(422, 'STOCK_LIMIT', 'A location balance cannot exceed 1,000,000,000 base units.');
  const changed = await Balance.updateOne({ _id: row._id, amount: { $gte: Math.max(0, -value) } }, { $inc: { amount: value, version: 1 } }, { session });
  if (changed.modifiedCount !== 1) throw insufficient();
  const [movement] = await Movement.create([{ organizationId: location.organizationId, siteId: location.siteId, farmId: location.farmId, itemId: item._id, locationId: location._id, amount: value, unit: item.unit, itemName: item.name, locationName: location.name, createdBy: actor.id, createdByName: actor.name, ...fields }], { session });
  return movement;
}
const insufficient = () => new AppError(409, 'INSUFFICIENT_STOCK', 'This posting would make stock negative on its effective date or a later date. Receive stock first or correct the source/location.');
function fingerprint(input) { return createHash('sha256').update(JSON.stringify(input)).digest('hex'); }
function keyCheck(key) { if (!/^[\w-]{16,100}$/.test(key || '')) throw new AppError(422, 'IDEMPOTENCY_REQUIRED', 'Supply a 16-100 character Idempotency-Key.'); }
async function replay(actor, key, hash, session) {
  const existing = await Operation.findOne({ actorId: actor.id, requestKey: key }).session(session);
  if (!existing) return null;
  if (existing.fingerprint !== hash) throw new AppError(409, 'IDEMPOTENCY_CONFLICT', 'This key was already used for different inputs.');
  const rows = await Movement.find({ operationId: existing._id }).session(session);
  if (rows.length > 1 && !actor.permissions.includes('inventory.transfer')) throw denied();
  for (const row of rows) {
    await locationFor(actor, row.locationId, session); await dateCheck(actor, row.businessDate, session);
    if ((await itemFor(actor, String(row.itemId), session)).category === 'egg' && !actor.permissions.includes('egg-production.manage')) throw denied();
  }
  return rows.map(serialize);
}
export async function post(caller, input, key, requestId) {
  keyCheck(key);
  const permission = input.type === 'transfer' ? 'inventory.transfer' : ['adjustment', 'opening'].includes(input.type) ? 'inventory.adjust' : 'inventory.manage';
  return accessTransaction(caller, [permission], async (session, actor) => {
    const hash = fingerprint(input); const previous = await replay(actor, key, hash, session); if (previous) return previous;
    await dateCheck(actor, input.businessDate, session);
    const item = await itemFor(actor, input.itemId, session, true); const location = await locationFor(actor, input.locationId, session, true);
    if (input.unit !== item.unit) throw new AppError(422, 'UNSUPPORTED_UNIT', 'Post in the catalog base unit. Bag conversion belongs in the daily report.');
    if (input.type !== 'adjustment' && input.quantity <= 0) throw new AppError(422, 'INVALID_QUANTITY', 'Use a positive quantity. Only adjustments are signed.');
    if (input.type !== 'transfer' && input.destinationId) throw new AppError(422, 'INVALID_DESTINATION', 'Only transfers have a destination.');
    if (item.category === 'egg' && (!actor.permissions.includes('egg-production.manage') || !['adjustment', 'opening', 'transfer'].includes(input.type))) throw new AppError(403, 'EGG_SOURCE_REQUIRED', 'Egg changes require egg-production management and an opening, adjustment, or transfer. Production and sales use their source workflows.');
    if (item.category === 'feed' && input.type === 'issue' && input.purpose === 'other') throw new AppError(422, 'REPORT_CONSUMPTION_ONLY', 'Feed consumption must be submitted through a daily report. Manual feed issues are limited to documented loss or dispatch.');
    if (input.type === 'opening' && await Movement.exists({ itemId: item._id, locationId: location._id }).session(session)) throw new AppError(409, 'OPENING_EXISTS', 'Opening stock must be the first movement for this item/location.');
    let destination;
    if (input.type === 'transfer') {
      if (!input.destinationId || equal(location._id, input.destinationId)) throw new AppError(422, 'INVALID_DESTINATION', 'Choose a different permitted destination.');
      destination = await locationFor(actor, input.destinationId, session, true);
    }
    const [operation] = await Operation.create([{ organizationId: actor.organizationId, actorId: actor.id, requestKey: key, fingerprint: hash }], { session });
    const source = `manual:${operation._id}`;
    const fields = { operationId: operation._id, source: 'manual', type: input.type === 'transfer' ? 'transfer-out' : input.type, businessDate: input.businessDate, reason: input.reason, purpose: input.purpose, sourceKey: `${source}:out` };
    const rows = [await append(actor, item, location, scaled(input.quantity) * (['issue', 'transfer'].includes(input.type) ? -1 : 1), fields, session)];
    if (destination) rows.push(await append(actor, item, destination, scaled(input.quantity), { ...fields, type: 'transfer-in', sourceKey: `${source}:in` }, session));
    operation.movementIds = rows.map((r) => r._id); await operation.save({ session });
    await audit(actor, 'inventory.posted', 'stock-operation', operation._id, { movements: rows.map(serialize) }, requestId, session); return rows.map(serialize);
  }, { companyOnly: false });
}
export async function reverse(caller, id, input, key, requestId) {
  keyCheck(key);
  return accessTransaction(caller, ['inventory.adjust'], async (session, actor) => {
    const hash = fingerprint({ id, ...input }); const previous = await replay(actor, key, hash, session); if (previous) return previous;
    const original = await Movement.findOne({ _id: id, ...await scopeFilter(actor, 'flock', session) }).session(session);
    if (!original) throw notFound();
    if (original.source !== 'manual' || original.reversesId) throw new AppError(409, 'SOURCE_CORRECTION_ONLY', 'Correct generated stock through its source workflow; reversals cannot themselves be reversed.');
    const operation = await Operation.findById(original.operationId).session(session);
    if (operation.reversedBy) throw new AppError(409, 'ALREADY_REVERSED', 'This operation has already been reversed.');
    const rows = await Movement.find({ operationId: operation._id }).session(session);
    if (rows.length > 1 && !actor.permissions.includes('inventory.transfer')) throw denied();
    await dateCheck(actor, input.businessDate, session);
    if (input.businessDate < original.businessDate) throw new AppError(422, 'INVALID_REVERSAL_DATE', 'A reversal cannot precede its source.');
    const [reversal] = await Operation.create([{ organizationId: actor.organizationId, actorId: actor.id, requestKey: key, fingerprint: hash, reversesOperationId: operation._id }], { session });
    const results = [];
    for (const row of [...rows].sort((a, b) => b.amount - a.amount)) {
      await dateCheck(actor, row.businessDate, session);
      const item = await itemFor(actor, String(row.itemId), session, true); const location = await locationFor(actor, String(row.locationId), session, true);
      if (item.category === 'egg' && !actor.permissions.includes('egg-production.manage')) throw denied();
      results.push(await append(actor, item, location, -row.amount, { operationId: reversal._id, source: 'manual', type: 'reversal', businessDate: input.businessDate, reason: input.reason, reversesId: row._id, sourceKey: `reversal:${row._id}` }, session));
    }
    reversal.movementIds = results.map((r) => r._id); await reversal.save({ session }); operation.reversedBy = reversal._id; await operation.save({ session });
    await audit(actor, 'inventory.reversed', 'stock-operation', operation._id, { reason: input.reason, movements: results.map(serialize) }, requestId, session); return results.map(serialize);
  }, { companyOnly: false });
}
export async function reconcile(actor, query) {
  const filter = await scoped(actor, query);
  if (query.category) filter.itemId = { $in: (await Item.find({ organizationId: actor.organizationId, category: query.category, ...(query.itemId ? { _id: query.itemId } : {}) }).select('_id')).map((r) => r._id) };
  const [balances, movements] = await Promise.all([Balance.find(filter), Movement.find(filter).select('itemId locationId amount organizationId siteId farmId')]);
  const pairs = new Map(balances.map((b) => [`${b.itemId}:${b.locationId}`, { ...serialize(b), ledgerAmount: 0, cacheMissing: false }]));
  for (const movement of movements) {
    const key = `${movement.itemId}:${movement.locationId}`;
    if (!pairs.has(key)) pairs.set(key, { id: key, itemId: String(movement.itemId), locationId: String(movement.locationId), farmId: String(movement.farmId), quantity: null, ledgerAmount: 0, cacheMissing: true });
    pairs.get(key).ledgerAmount += movement.amount;
  }
  const rows = [...pairs.values()].sort((a, b) => a.id.localeCompare(b.id));
  const data = rows.slice((query.page - 1) * query.pageSize, query.page * query.pageSize);
  for (const row of data) {
    row.ledgerQuantity = row.ledgerAmount / 1000; delete row.ledgerAmount;
    row.matches = !row.cacheMissing && row.ledgerQuantity === row.quantity;
    const [item, location] = await Promise.all([Item.findById(row.itemId), Location.findById(row.locationId)]);
    row.itemName = item?.name || 'Missing catalog item'; row.unit = item?.unit; row.locationName = location?.name || 'Missing stock location';
  }
  return { data, meta: { page: query.page, pageSize: query.pageSize, total: rows.length } };
}
export async function feedOptions(actor, flockId, query) {
  const flock = await entity(actor, 'flock', flockId);
  return { items: (await list(actor, 'items', { ...query, category: 'feed', active: 'true' })), locations: (await list(actor, 'locations', { ...query, farmId: String(flock.farmId), active: 'true' })) };
}
// Called inside the report publication transaction. Baseline is actual posted feed,
// never descriptive legacy report snapshots. Moving the item/location refunds the
// original pair and consumes the new pair even when total kg is unchanged.
export async function publishFeed(actor, report, kg, revision, reason, session) {
  const previous = await FeedPublication.findOne({ reportId: report._id }).sort({ revision: -1 }).session(session);
  let item; let location;
  if (kg > 0) {
    item = await itemFor(actor, report.data.feed.itemReference, session, true); location = await locationFor(actor, report.data.feed.locationReference, session, true);
    if (item.category !== 'feed' || item.unit !== 'kg' || !equal(location.farmId, report.farmId) || location.kind === 'collection') throw new AppError(422, 'INVALID_FEED_REFERENCE', 'Choose a kg feed item and a store in the report farm.');
  }
  const same = kg > 0 && previous?.feedKg > 0 && equal(item._id, previous.itemId) && equal(location._id, previous.locationId);
  const movements = []; const fields = { source: 'report', reportId: report._id, revision, businessDate: report.businessDate, reason: reason || 'Published daily report feed', purpose: 'report-consumption' };
  const prefix = `report:${report._id}:revision:${revision}:feed`;
  if (same) {
    const delta = scaled(previous.feedKg) - scaled(kg);
    if (delta) movements.push(await append(actor, item, location, delta, { ...fields, type: 'report-feed', sourceKey: `${prefix}:delta` }, session));
  } else {
    if (previous?.feedKg > 0) {
      const beforeItem = await itemFor(actor, String(previous.itemId), session, true); const beforeLocation = await locationFor(actor, String(previous.locationId), session, true);
      movements.push(await append(actor, beforeItem, beforeLocation, scaled(previous.feedKg), { ...fields, type: 'report-feed-refund', sourceKey: `${prefix}:refund` }, session));
    }
    if (kg > 0) movements.push(await append(actor, item, location, -scaled(kg), { ...fields, type: 'report-feed', sourceKey: `${prefix}:issue` }, session));
  }
  await FeedPublication.create([{ organizationId: report.organizationId, siteId: report.siteId, farmId: report.farmId, reportId: report._id, revision, feedKg: kg, itemId: item?._id, locationId: location?._id, movementIds: movements.map((r) => r._id) }], { session });
  return { feedStatus: 'posted', legacyFeedBaseline: !previous && report.publishedRevision > 0, movementIds: movements.map((r) => String(r._id)) };
}
