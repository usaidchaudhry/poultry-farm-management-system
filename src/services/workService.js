import { ROLE_PERMISSIONS } from '../config/roles.js';
import { PERMISSIONS as P } from '../config/permissions.js';
import { orgStore } from './mock/mockOrgStore.js';
import { ApiError } from './apiError.js';

const KEY = 'pms.mock.work.v1';
const KINDS = ['dailyReports', 'clinicalVisits', 'medicationTasks', 'inventoryItems', 'stockMovements', 'feedFormulas', 'eggProduction', 'sales', 'expenses', 'measurements', 'notifications', 'audit'];
const EMPTY = Object.fromEntries(KINDS.map((kind) => [kind, []]));
const SEED = {
  ...EMPTY,
  dailyReports: [{ id: 'demo-report', farmId: 'f1', houseId: 'h1', flockId: 'fl1', date: '2026-11-07', status: 'submitted', eggs: { jumbo: 60, starter: 40, standard: 480, small: 20, floor: 10, broken: 5, discard: 5 }, totalEggs: 620, peti: 620 / 360, openingBirds: 11500, mortality: 2, remainingBirds: 11498, feedBags: 20, bagSize: 50, waterLitres: 1200, lightHours: 15, postMortem: 'Two birds observed; follow-up requested.', history: [{ status: 'submitted', at: '2026-11-07T08:00:00.000Z', by: 'u3' }], createdAt: '2026-11-07T08:00:00.000Z' }],
  clinicalVisits: [{ id: 'demo-visit', farmId: 'f1', houseId: 'h1', flockId: 'fl1', date: '2026-11-07', diagnosis: 'Routine follow-up', observations: 'Observe water consumption.', medicine: 'Demo medicine', dose: 'Per approved protocol', route: 'water', frequency: 'daily', duration: 3, dueAt: '2026-11-08', status: 'recorded', createdBy: 'u5', createdAt: '2026-11-07T09:00:00.000Z' }],
  medicationTasks: [{ id: 'demo-medication', visitId: 'demo-visit', farmId: 'f1', houseId: 'h1', flockId: 'fl1', medicine: 'Demo medicine', dose: 'Per approved protocol', route: 'water', frequency: 'daily', duration: 3, dueAt: '2026-11-08', prescribedBy: 'u5', prescriptionStatus: 'active', status: 'due', createdAt: '2026-11-07T09:00:00.000Z' }],
  inventoryItems: [{ id: 'demo-feed', name: 'Layer feed', category: 'Feed', unit: 'bags', balance: 45, minimum: 50, createdAt: '2026-11-07T08:00:00.000Z' }],
  feedFormulas: [{ id: 'demo-formula', name: 'Layer mix', farmId: 'f1', bagSize: 50, ingredients: [{ name: 'Maize', quantity: 60 }, { name: 'Soy meal', quantity: 40 }], status: 'pending_costing', version: 1, versions: [], createdAt: '2026-11-07T08:00:00.000Z' }],
  eggProduction: [{ id: 'demo-production', farmId: 'f1', date: '2026-11-07', eggs: { standard: 1000 }, damaged: 10, rejected: 10, totalEggs: 1000, saleableEggs: 980, createdAt: '2026-11-07T08:00:00.000Z' }],
  sales: [{ id: 'demo-sale', farmId: 'f1', date: '2026-11-07', buyer: 'Local buyer', quantity: 1, unit: 'Peti', eggs: 360, unitPrice: 18000, total: 18000, paymentStatus: 'paid', createdAt: '2026-11-07T08:00:00.000Z' }],
  expenses: [{ id: 'demo-expense', farmId: 'f1', date: '2026-11-07', category: 'Feed', amount: 7000, description: 'Feed delivery', createdAt: '2026-11-07T08:00:00.000Z' }],
  measurements: [{ id: 'demo-weight', farmId: 'f1', houseId: 'h1', flockId: 'fl1', date: '2026-11-07', sampleSize: 50, averageWeight: 1600, unit: 'g', createdAt: '2026-11-07T08:00:00.000Z' }],
  notifications: [{ id: 'demo-alert', title: 'Layer feed is below minimum stock', severity: 'warning', source: 'inventoryItems', status: 'created', createdAt: '2026-11-07T08:00:00.000Z' }],
};
const clone = (value) => JSON.parse(JSON.stringify(value));
const read = () => { try { const raw = localStorage.getItem(KEY); return raw ? { ...clone(EMPTY), ...JSON.parse(raw) } : clone(SEED); } catch { return clone(SEED); } };
const write = (data) => { try { localStorage.setItem(KEY, JSON.stringify(data)); globalThis.window?.dispatchEvent(new Event('pms-work-changed')); } catch { throw new ApiError('Browser storage is full or unavailable.', { code: 'STORAGE', status: 507 }); } };
const permissions = (actor) => ROLE_PERMISSIONS[actor?.role] || [];
const requirePermission = (actor, code) => { if (!permissions(actor).includes(code)) throw new ApiError('You do not have permission for this action.', { code: 'FORBIDDEN', status: 403 }); };
const access = (actor) => {
  const org = { sites: orgStore.all('sites'), farms: orgStore.all('farms'), houses: orgStore.all('houses'), flocks: orgStore.all('flocks') };
  if (actor.role === 'owner' || actor.role === 'production_manager') return org;
  const assignment = orgStore.assignments()[actor.id] || { siteIds: [], farmIds: [] };
  org.farms = org.farms.filter((row) => assignment.siteIds.includes(row.siteId) || assignment.farmIds.includes(row.id));
  org.sites = org.sites.filter((row) => assignment.siteIds.includes(row.id) || org.farms.some((farm) => farm.siteId === row.id));
  org.houses = org.houses.filter((row) => org.farms.some((farm) => farm.id === row.farmId));
  org.flocks = org.flocks.filter((row) => org.houses.some((house) => house.id === row.houseId));
  return org;
};
const inScope = (row, actor) => {
  if (!row.farmId && !row.houseId && !row.flockId) return true;
  const org = access(actor);
  if (row.farmId && !org.farms.some((farm) => farm.id === row.farmId)) return false;
  if (row.houseId && !org.houses.some((house) => house.id === row.houseId)) return false;
  if (row.flockId && !org.flocks.some((flock) => flock.id === row.flockId)) return false;
  const house = row.houseId ? org.houses.find((item) => item.id === row.houseId) : null;
  const flock = row.flockId ? org.flocks.find((item) => item.id === row.flockId) : null;
  if (house && row.farmId && house.farmId !== row.farmId) return false;
  if (flock && row.houseId && flock.houseId !== row.houseId) return false;
  if (flock && row.farmId && org.houses.find((item) => item.id === flock.houseId)?.farmId !== row.farmId) return false;
  return true;
};
const activeLocation = (row) => {
  const sites = orgStore.all('sites');
  const farms = orgStore.all('farms');
  const houses = orgStore.all('houses');
  const flocks = orgStore.all('flocks');
  const farm = row.farmId ? farms.find((item) => item.id === row.farmId) : null;
  const house = row.houseId ? houses.find((item) => item.id === row.houseId) : null;
  const flock = row.flockId ? flocks.find((item) => item.id === row.flockId) : null;
  return (!row.farmId || (farm?.status === 'active' && sites.find((item) => item.id === farm.siteId)?.status === 'active'))
    && (!row.houseId || house?.status === 'active')
    && (!row.flockId || flock?.status === 'active');
};
const get = (data, kind, id) => {
  const row = data[kind]?.find((item) => item.id === id);
  if (!row) throw new ApiError('Record not found.', { code: 'NOT_FOUND', status: 404 });
  return row;
};
const nextId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const number = (value) => Number(value) || 0;
const eggTotal = (eggs) => Object.values(eggs || {}).reduce((sum, value) => sum + number(value), 0);
const validEggCounts = (eggs) => Object.values(eggs || {}).every((value) => Number.isInteger(Number(value)) && Number(value) >= 0);
const validBirdCounts = (row) => ['openingBirds', 'birdsPlaced', 'transfersIn', 'transfersOut', 'mortality'].every((key) => Number.isInteger(Number(row[key] || 0)) && Number(row[key] || 0) >= 0);
const remainingBirds = (row) => number(row.openingBirds) + number(row.birdsPlaced) + number(row.transfersIn) - number(row.transfersOut) - number(row.mortality);
const audit = (data, actor, action, kind, record, before = null) => data.audit.unshift({ id: nextId(), at: new Date().toISOString(), actorId: actor.id, action, module: kind, targetId: record.id, before, after: clone(record) });
const notify = (data, title, severity, source, farmId, now) => data.notifications.unshift({ id: nextId(), title, severity, source, farmId, status: 'created', createdAt: now });
const viewPermission = { dailyReports: P.DAILY_REPORTS_VIEW, clinicalVisits: P.CLINICAL_VIEW, medicationTasks: P.MEDICATION_VIEW, inventoryItems: P.INVENTORY_VIEW, stockMovements: P.INVENTORY_VIEW, feedFormulas: P.FEED_FORMULAS_VIEW, eggProduction: P.EGG_PRODUCTION_VIEW, sales: P.SALES_VIEW, expenses: P.FINANCE_VIEW, measurements: P.BIRD_PARAMETERS_VIEW, notifications: P.NOTIFICATIONS_VIEW, audit: P.AUDIT_VIEW };
const editPermission = { dailyReports: P.DAILY_REPORTS_MANAGE, clinicalVisits: P.CLINICAL_MANAGE, medicationTasks: P.MEDICATION_ADMINISTER, inventoryItems: P.INVENTORY_MANAGE, stockMovements: P.INVENTORY_MANAGE, feedFormulas: P.FEED_FORMULAS_COMPOSE, eggProduction: P.EGG_PRODUCTION_MANAGE, sales: P.SALES_MANAGE, expenses: P.FINANCE_MANAGE, measurements: P.BIRD_PARAMETERS_MANAGE, notifications: P.NOTIFICATIONS_MANAGE };

export const workService = {
  recordAudit(actor, action, kind, record, before = null) {
    const data = read();
    audit(data, actor || { id: 'system' }, action, kind, record, before);
    write(data);
  },
  list(kind, actor) {
    requirePermission(actor, viewPermission[kind]);
    return clone(read()[kind].filter((row) => inScope(row, actor)));
  },
  create(kind, values, actor) {
    requirePermission(actor, editPermission[kind]);
    if (!inScope(values, actor)) throw new ApiError('This farm or flock is outside your assigned scope.', { code: 'SCOPE', status: 403 });
    if (!activeLocation(values)) throw new ApiError('Select an active farm, house, and flock.', { code: 'ARCHIVED_SCOPE', status: 409 });
    const data = read();
    const now = new Date().toISOString();
    if (['dailyReports', 'eggProduction'].includes(kind) && !validEggCounts(values.eggs)) throw new ApiError('Egg counts must be nonnegative whole numbers.', { code: 'VALIDATION', status: 400 });
    if (kind === 'dailyReports' && (!validBirdCounts(values) || remainingBirds(values) < 0)) throw new ApiError('Bird counts must be whole numbers and cannot produce a negative remaining population.', { code: 'VALIDATION', status: 400 });
    if (kind === 'clinicalVisits' && values.medicine && (!values.dose || !values.route || !values.frequency || !values.dueAt)) throw new ApiError('Complete dose, route, frequency, and first due date for a prescription.', { code: 'VALIDATION', status: 400 });
    if (kind === 'inventoryItems' && (Number(values.balance) < 0 || Number(values.minimum || 0) < 0)) throw new ApiError('Stock values cannot be negative.', { code: 'VALIDATION', status: 400 });
    if (kind === 'expenses' && !(Number(values.amount) > 0)) throw new ApiError('Expense amount must be positive.', { code: 'VALIDATION', status: 400 });
    if (kind === 'measurements' && (!(Number(values.sampleSize) > 0) || !(Number(values.averageWeight) > 0))) throw new ApiError('Sample size and weight must be positive.', { code: 'VALIDATION', status: 400 });
    let record = { ...values, id: nextId(), createdAt: now, updatedAt: now, createdBy: actor.id };
    if (kind === 'dailyReports') {
      if (!values.flockId || !values.date) throw new ApiError('Select a flock and business date.', { code: 'VALIDATION', status: 400 });
      if (data.dailyReports.some((row) => row.flockId === values.flockId && row.date === values.date)) throw new ApiError('A report already exists for this flock and date.', { code: 'DUPLICATE', status: 409 });
      record = { ...record, status: values.status === 'submitted' ? 'submitted' : 'draft', history: [{ status: values.status === 'submitted' ? 'submitted' : 'draft', at: now, by: actor.id }], totalEggs: eggTotal(values.eggs), peti: eggTotal(values.eggs) / 360, remainingBirds: remainingBirds(values) };
      if (number(values.mortality) > 0) notify(data, `Mortality recorded: ${values.mortality} birds`, 'warning', 'dailyReports', values.farmId, now);
    }
    if (kind === 'clinicalVisits') record.status = 'recorded';
    if (kind === 'feedFormulas') record = { ...record, status: 'draft', version: 1, versions: [], ingredients: values.ingredients || [] };
    if (kind === 'medicationTasks' || kind === 'audit') throw new ApiError('This record is created by its source workflow.', { code: 'INVALID_ACTION', status: 400 });
    if (kind === 'stockMovements') {
      const item = get(data, 'inventoryItems', values.itemId);
      const change = values.type === 'transfer' ? 0 : values.type === 'receipt' ? number(values.quantity) : values.type === 'issue' ? -number(values.quantity) : number(values.quantity);
      if (values.type === 'transfer' && (!values.fromFarmId || !values.toFarmId || values.fromFarmId === values.toFarmId || !inScope({ farmId: values.fromFarmId }, actor) || !inScope({ farmId: values.toFarmId }, actor) || !activeLocation({ farmId: values.fromFarmId }) || !activeLocation({ farmId: values.toFarmId }))) throw new ApiError('Select two different active, permitted farms for transfer.', { code: 'VALIDATION', status: 400 });
      if (values.type !== 'adjustment' && !(Number(values.quantity) > 0)) throw new ApiError('Enter a positive quantity.', { code: 'VALIDATION', status: 400 });
      if (!Number.isFinite(change) || (values.type !== 'transfer' && !change)) throw new ApiError('Enter a nonzero quantity.', { code: 'VALIDATION', status: 400 });
      if (number(item.balance) + change < 0) throw new ApiError('Insufficient stock.', { code: 'INSUFFICIENT_STOCK', status: 409 });
      if (values.type !== 'transfer') {
        const before = clone(item);
        item.balance = number(item.balance) + change;
        item.updatedAt = now;
        if (item.balance <= number(item.minimum)) notify(data, `Low stock: ${item.name}`, item.balance <= 0 ? 'critical' : 'warning', 'inventoryItems', null, now);
        audit(data, actor, 'stock balance updated', 'inventoryItems', item, before);
      }
    }
    if (kind === 'sales') {
      if (!(Number(values.quantity) > 0) || !(Number(values.unitPrice) >= 0)) throw new ApiError('Enter a positive quantity and nonnegative price.', { code: 'VALIDATION', status: 400 });
      const eggs = number(values.quantity) * (values.unit === 'Peti' ? 360 : 1);
      const produced = data.eggProduction.filter((row) => row.farmId === values.farmId).reduce((sum, row) => sum + number(row.saleableEggs), 0);
      const sold = data.sales.filter((row) => row.farmId === values.farmId).reduce((sum, row) => sum + number(row.eggs), 0);
      if (eggs <= 0 || eggs > produced - sold) throw new ApiError('Sale exceeds available saleable eggs.', { code: 'OVERSOLD', status: 409 });
      record.eggs = eggs;
      record.total = number(values.quantity) * number(values.unitPrice);
    }
    if (kind === 'eggProduction') {
      if (data.eggProduction.some((row) => row.farmId === values.farmId && row.date === values.date)) throw new ApiError('Production is already recorded for this farm and date.', { code: 'DUPLICATE', status: 409 });
      if (Number(values.damaged || 0) < 0 || Number(values.rejected || 0) < 0) throw new ApiError('Damaged and rejected counts cannot be negative.', { code: 'VALIDATION', status: 400 });
      record.totalEggs = eggTotal(values.eggs);
      record.saleableEggs = record.totalEggs - number(values.damaged) - number(values.rejected);
      if (record.saleableEggs < 0) throw new ApiError('Damaged and rejected eggs exceed production.', { code: 'VALIDATION', status: 400 });
    }
    data[kind].unshift(record);
    if (kind === 'clinicalVisits' && values.medicine) data.medicationTasks.unshift({ id: nextId(), visitId: record.id, farmId: record.farmId, houseId: record.houseId, flockId: record.flockId, medicine: values.medicine, dose: values.dose, route: values.route, frequency: values.frequency, duration: values.duration, dueAt: values.dueAt, prescribedBy: actor.id, prescriptionStatus: 'active', status: 'due', createdAt: now });
    audit(data, actor, 'created', kind, record);
    write(data);
    return clone(record);
  },
  update(kind, id, values, actor) {
    requirePermission(actor, editPermission[kind]);
    const data = read();
    const row = get(data, kind, id);
    if (!inScope(row, actor)) throw new ApiError('Outside your assigned scope.', { code: 'SCOPE', status: 403 });
    if (kind === 'dailyReports' && !['draft', 'returned'].includes(row.status)) throw new ApiError('Only draft or returned reports can be edited.', { code: 'LOCKED', status: 409 });
    if (kind === 'dailyReports' && (!validEggCounts(values.eggs) || !validBirdCounts(values) || remainingBirds(values) < 0)) throw new ApiError('Check egg and bird counts before saving.', { code: 'VALIDATION', status: 400 });
    if (['dailyReports', 'clinicalVisits'].includes(kind) && (values.farmId !== row.farmId || values.houseId !== row.houseId || values.flockId !== row.flockId || values.date !== row.date)) throw new ApiError('The location and date of this record cannot be changed.', { code: 'VALIDATION', status: 400 });
    if (kind === 'feedFormulas' && !['draft', 'returned'].includes(row.status)) throw new ApiError('Only draft or returned formulas can be edited.', { code: 'LOCKED', status: 409 });
    if (kind === 'feedFormulas' && values.farmId !== row.farmId) throw new ApiError('A formula cannot move to another farm.', { code: 'VALIDATION', status: 400 });
    if (kind === 'inventoryItems' && Number(values.minimum || 0) < 0) throw new ApiError('Minimum stock cannot be negative.', { code: 'VALIDATION', status: 400 });
    if (kind === 'clinicalVisits' && values.medicine && (!values.dose || !values.route || !values.frequency || !values.dueAt)) throw new ApiError('Complete the prescription fields.', { code: 'VALIDATION', status: 400 });
    const task = kind === 'clinicalVisits' ? data.medicationTasks.find((item) => item.visitId === id) : null;
    if (task && !['due', 'overdue'].includes(task.status)) throw new ApiError('A prescription with a recorded administration cannot be edited.', { code: 'LOCKED', status: 409 });
    const patch = { ...values };
    if (kind === 'inventoryItems') delete patch.balance;
    const before = clone(row);
    Object.assign(row, patch, { updatedAt: new Date().toISOString() });
    if (kind === 'clinicalVisits') {
      if (task) {
        Object.assign(task, values.medicine ? { medicine: values.medicine, dose: values.dose, route: values.route, frequency: values.frequency, duration: values.duration, dueAt: values.dueAt, prescriptionStatus: 'active', status: 'due' } : { prescriptionStatus: 'cancelled', status: 'cancelled' });
      } else if (values.medicine) data.medicationTasks.unshift({ id: nextId(), visitId: row.id, farmId: row.farmId, houseId: row.houseId, flockId: row.flockId, medicine: values.medicine, dose: values.dose, route: values.route, frequency: values.frequency, duration: values.duration, dueAt: values.dueAt, prescribedBy: actor.id, prescriptionStatus: 'active', status: 'due', createdAt: row.updatedAt });
    }
    if (kind === 'dailyReports') { row.totalEggs = eggTotal(row.eggs); row.peti = row.totalEggs / 360; row.remainingBirds = remainingBirds(row); if (patch.status === 'submitted') row.history.push({ status: 'submitted', at: row.updatedAt, by: actor.id }); }
    audit(data, actor, 'updated', kind, row, before);
    write(data);
    return clone(row);
  },
  transition(kind, id, action, details, actor) {
    const data = read();
    const row = get(data, kind, id);
    if (!inScope(row, actor)) throw new ApiError('Outside your assigned scope.', { code: 'SCOPE', status: 403 });
    const before = clone(row);
    const now = new Date().toISOString();
    if (kind === 'dailyReports') {
      requirePermission(actor, action === 'return' ? P.DAILY_REPORTS_REVIEW : P.DAILY_REPORTS_MANAGE);
      if (action === 'submit' && ['draft', 'returned'].includes(row.status)) row.status = 'submitted';
      else if (action === 'return' && row.status === 'submitted') { if (!details.reason?.trim()) throw new ApiError('Enter a correction reason.', { code: 'VALIDATION', status: 400 }); row.status = 'returned'; row.returnReason = details.reason.trim(); }
      else throw new ApiError('This report cannot make that status change.', { code: 'INVALID_TRANSITION', status: 409 });
      row.history.push({ status: row.status, at: now, by: actor.id, note: details.reason || '' });
    } else if (kind === 'medicationTasks') {
      requirePermission(actor, P.MEDICATION_ADMINISTER);
      if (row.prescribedBy === actor.id) throw new ApiError('You cannot confirm your own prescription.', { code: 'SEPARATION_OF_DUTIES', status: 403 });
      if (!['due', 'overdue'].includes(row.status)) throw new ApiError('This task is already closed.', { code: 'INVALID_TRANSITION', status: 409 });
      if (!['completed', 'missed'].includes(action)) throw new ApiError('Invalid outcome.', { code: 'INVALID_TRANSITION', status: 400 });
      row.status = action; row.administeredAt = details.at || now; row.administeredBy = actor.id; row.actualDose = details.dose || ''; row.comments = details.comments || '';
    } else if (kind === 'feedFormulas') {
      const compose = action === 'submit' || action === 'revise';
      requirePermission(actor, compose ? P.FEED_FORMULAS_COMPOSE : P.FEED_FORMULAS_COST);
      if (action === 'revise' && row.status === 'finalized') { row.version += 1; row.status = 'draft'; row.ingredients = row.ingredients.map(({ name, quantity }) => ({ name, quantity })); delete row.totalCost; delete row.costPerKg; delete row.costPerBag; }
      else if (action === 'submit' && ['draft', 'returned'].includes(row.status)) { if (row.status === 'returned') row.version += 1; row.status = 'pending_costing'; }
      else if (action === 'return' && row.status === 'pending_costing') { if (!details.reason?.trim()) throw new ApiError('Enter a return reason.', { code: 'VALIDATION', status: 400 }); row.status = 'returned'; row.returnReason = details.reason.trim(); }
      else if (action === 'finalize' && row.status === 'pending_costing') {
        const ingredients = row.ingredients.map((item, index) => ({ ...item, rate: number(details.rates?.[index]), cost: number(item.quantity) * number(details.rates?.[index]) }));
        if (ingredients.some((item) => item.quantity <= 0 || item.rate <= 0)) throw new ApiError('Every ingredient needs a positive quantity and rate.', { code: 'VALIDATION', status: 400 });
        row.ingredients = ingredients; row.totalKg = ingredients.reduce((sum, item) => sum + number(item.quantity), 0); row.totalCost = ingredients.reduce((sum, item) => sum + item.cost, 0); row.costPerKg = row.totalCost / row.totalKg; row.costPerBag = row.costPerKg * number(row.bagSize || 50); row.status = 'finalized'; row.versions.push({ version: row.version, at: now, ingredients: clone(ingredients), totalCost: row.totalCost, costPerKg: row.costPerKg, costPerBag: row.costPerBag });
      } else throw new ApiError('This formula cannot make that status change.', { code: 'INVALID_TRANSITION', status: 409 });
    } else if (kind === 'notifications') {
      requirePermission(actor, P.NOTIFICATIONS_MANAGE);
      if (!['acknowledged', 'resolved'].includes(action)) throw new ApiError('Invalid notification status.', { code: 'INVALID_TRANSITION', status: 400 });
      row.status = action; row.response = details.reason || ''; row.respondedBy = actor.id;
    } else throw new ApiError('Unknown workflow.', { code: 'INVALID_ACTION', status: 400 });
    row.updatedAt = now;
    audit(data, actor, action, kind, row, before);
    write(data);
    return clone(row);
  },
};
