import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const storage = new Map();
globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: (key) => storage.delete(key), clear: () => storage.clear() };
const { workService } = await import('../src/services/workService.js');
const owner = { id: 'u1', role: 'owner' };
const farmManager = { id: 'u3', role: 'farm_manager' };
const operator = { id: 'u4', role: 'operation_manager' };

beforeEach(() => storage.clear());

test('a report saves calculated totals and rejects a duplicate business date', () => {
  const values = { farmId: 'f1', houseId: 'h1', flockId: 'fl1', date: '2026-11-08', status: 'draft', eggs: { standard: 360, broken: 2 }, openingBirds: 100, mortality: 1 };
  const saved = workService.create('dailyReports', values, farmManager);
  assert.equal(saved.totalEggs, 362);
  assert.equal(saved.peti, 362 / 360);
  assert.equal(saved.remainingBirds, 99);
  assert.throws(() => workService.create('dailyReports', values, farmManager), { code: 'DUPLICATE' });
});

test('farm and flock must belong to the same branch', () => {
  assert.throws(() => workService.create('dailyReports', { farmId: 'f1', houseId: 'h3', flockId: 'fl3', date: '2026-11-08' }, farmManager), { code: 'SCOPE' });
});

test('a prescriber cannot confirm their own task, while an authorized farm user can', () => {
  const visit = workService.create('clinicalVisits', { farmId: 'f1', houseId: 'h1', flockId: 'fl1', date: '2026-11-08', diagnosis: 'Check', medicine: 'Medicine', dose: '1 unit', route: 'water', frequency: 'daily', dueAt: '2026-11-08' }, owner);
  const task = workService.list('medicationTasks', owner).find((row) => row.visitId === visit.id);
  assert.throws(() => workService.transition('medicationTasks', task.id, 'completed', {}, owner), { code: 'SEPARATION_OF_DUTIES' });
  const completed = workService.transition('medicationTasks', task.id, 'completed', { dose: '1 unit' }, farmManager);
  assert.equal(completed.status, 'completed');
  assert.equal(completed.administeredBy, farmManager.id);
});

test('formula quantities and pricing remain separate', () => {
  const formula = workService.create('feedFormulas', { name: 'Test mix', farmId: 'f1', bagSize: 50, ingredients: [{ name: 'Maize', quantity: 60 }, { name: 'Soy', quantity: 40 }] }, farmManager);
  assert.equal(formula.status, 'draft');
  assert.throws(() => workService.transition('feedFormulas', formula.id, 'finalize', { rates: { 0: 10, 1: 20 } }, farmManager), { code: 'FORBIDDEN' });
  workService.transition('feedFormulas', formula.id, 'submit', {}, farmManager);
  const final = workService.transition('feedFormulas', formula.id, 'finalize', { rates: { 0: 10, 1: 20 } }, operator);
  assert.equal(final.totalCost, 1400);
  assert.equal(final.costPerBag, 700);
  assert.equal(final.versions.length, 1);
  const revised = workService.transition('feedFormulas', formula.id, 'revise', {}, farmManager);
  assert.equal(revised.status, 'draft');
  assert.equal(revised.version, 2);
  assert.equal(revised.versions.length, 1);
});

test('an open clinical prescription can be edited before administration', () => {
  const visit = workService.create('clinicalVisits', { farmId: 'f1', houseId: 'h1', flockId: 'fl1', date: '2026-11-08', diagnosis: 'Check', medicine: 'Medicine', dose: '1 unit', route: 'water', frequency: 'daily', dueAt: '2026-11-08' }, owner);
  workService.update('clinicalVisits', visit.id, { ...visit, dose: '2 units' }, owner);
  const task = workService.list('medicationTasks', owner).find((row) => row.visitId === visit.id);
  assert.equal(task.dose, '2 units');
});

test('sales cannot exceed saleable egg stock', () => {
  assert.throws(() => workService.create('sales', { farmId: 'f1', date: '2026-11-08', buyer: 'Buyer', quantity: 2, unit: 'Peti', unitPrice: 100 }, operator), { code: 'OVERSOLD' });
});

test('audit events are recorded after mutations', () => {
  workService.create('expenses', { farmId: 'f1', date: '2026-11-08', category: 'Feed', amount: 100 }, operator);
  const events = workService.list('audit', owner);
  assert.equal(events[0].module, 'expenses');
  assert.equal(events[0].actorId, operator.id);
});
