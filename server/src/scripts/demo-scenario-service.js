import { Organization, Role, User, AuditEvent } from '../modules/access/models.js';
import { actorFrom } from '../modules/access/serialization.js';
import { hierarchyModels as H } from '../modules/organization/models.js';
import { assign as assignScope } from '../modules/organization/service.js';
import { seedDemoHierarchy } from './demo-hierarchy-service.js';
import * as users from '../modules/users/service.js';
import * as stock from '../modules/inventory/service.js';
import * as reports from '../modules/reports/service.js';
import * as clinical from '../modules/clinical/service.js';
import * as formulas from '../modules/formulas/service.js';
import * as commerce from '../modules/commerce/service.js';
import * as alerts from '../modules/notifications/service.js';
import { runReminders } from '../modules/notifications/worker.js';
import { InventoryItem, StockLocation } from '../modules/inventory/models.js';
import { DailyReport, BirdMeasurement } from '../modules/reports/models.js';
import { ClinicalVisit, Prescription } from '../modules/clinical/models.js';
import { FormulaVersion, FeedFormula } from '../modules/formulas/models.js';
import { Notification } from '../modules/notifications/models.js';
import * as evidence from '../modules/evidence/service.js';
import { parse } from '../lib/validation.js';
import { password } from '../lib/validation.js';
import { businessDate } from '../policies/dates.js';
import * as reportInputs from '../modules/reports/validation.js';
import * as clinicalInputs from '../modules/clinical/validation.js';
import * as formulaInputs from '../modules/formulas/validation.js';
import * as commerceInputs from '../modules/commerce/validation.js';
const request = 'explicit-demo-scenario-cli';
export async function seedDemoScenario(config, temporaryPassword) {
  if (config.production || config.nodeEnv === 'production') throw new Error('Demo seeding is disabled in production.');
  parse(password, temporaryPassword);
  const org = await Organization.findOne({ key: 'default' }); const role = await Role.findOne({ organizationId: org._id, isProtected: true });
  const owner = await User.findOne({ organizationId: org._id, roleId: role?._id, isActive: true, mustChangePassword: false }).select('+authVersion').populate('roleId');
  if (!owner) throw new Error('Bootstrap the Owner and complete its first password change before full demo seeding.');
  const actor = actorFrom(owner); const today = businessDate(new Date(), org.timezone); const yesterday = businessDate(new Date(Date.now() - 86400000), org.timezone);
  if (!await H.site.exists({ organizationId: org._id })) await seedDemoHierarchy(temporaryPassword);
  const site = await H.site.findOne({ organizationId: org._id, nameKey: 'demo north site' });
  if (!site || await H.site.countDocuments({ organizationId: org._id }) !== 1 || !await AuditEvent.exists({ action: 'organization.demo-seeded', targetId: String(site._id) })) throw new Error('Full demo seeding requires its own empty or previously seeded demo hierarchy. Existing unrelated records were preserved.');
  const farms = await H.farm.find({ siteId: site._id }).sort({ nameKey: 1 }); if (farms.length !== 2) throw new Error('The demonstration hierarchy was changed; existing records were preserved.');
  const accounts = ['demo-alpha@layerflow.test', 'demo-beta@layerflow.test'];
  for (const [code, email, name] of [['owner', 'demo-owner@layerflow.test', 'Demo Owner'], ['production_manager', 'demo-production@layerflow.test', 'Demo Production Manager'], ['operation_manager', 'demo-operations@layerflow.test', 'Demo Operation Manager'], ['doctor', 'demo-doctor@layerflow.test', 'Demo Doctor']]) {
    if (!await User.exists({ organizationId: org._id, email })) {
      const template = await Role.findOne({ organizationId: org._id, code }); if (!template) throw new Error('Keep the default role templates before seeding the demonstration.');
      let member = await users.createUser(actor, { name, email, password: temporaryPassword, isActive: true }, request);
      member = await users.assignRole(actor, member.id, { roleId: String(template._id), version: member.version }, request);
      if (template.scopeMode === 'assigned') await assignScope(actor, member.id, { siteIds: [], farmIds: (code === 'doctor' ? [farms[0]] : farms).map((f) => String(f._id)), version: member.version }, request);
    }
    accounts.push(email);
  }
  const item = async (name, category) => {
    const found = await InventoryItem.findOne({ organizationId: org._id, name });
    return found ? { id: String(found._id) } : stock.saveItem(actor, null, { name, category, unit: 'kg', active: true }, request);
  };
  const feed = await item('Demo feed — sample only', 'feed'); const maize = await item('Demo maize — sample only', 'ingredient'); const soy = await item('Demo soy — sample only', 'ingredient');
  for (const [index, farm] of farms.entries()) {
    const flock = await H.flock.findOne({ farmId: farm._id }); if (!flock) throw new Error('The demo flock is missing.');
    const store = await StockLocation.findOne({ farmId: farm._id, kind: 'store' });
    await stock.post(actor, { type: 'receipt', itemId: feed.id, locationId: String(store._id), quantity: 500, unit: 'kg', businessDate: flock.placementDate, reason: 'Demonstration opening supply, not operational stock', purpose: 'other' }, `demo-stock-v1-${farm._id}`, request);
    for (const date of [yesterday, today].filter((d) => d >= flock.placementDate)) if (!await DailyReport.exists({ flockId: flock._id, businessDate: date })) {
      const pop = await reports.populationContext(actor, String(flock._id), date);
      if (pop.gap) await reports.addMovement(actor, String(flock._id), { businessDate: date, type: 'reconciliation', count: pop.availableBirds, reason: 'Explicit counted-opening sample for a gap in demonstration days' }, request);
      const input = parse(reportInputs.createSchema, { flockId: String(flock._id), businessDate: date, data: { eggs: { jumbo: 0, starter: 0, standard: date === today ? index === 0 ? 720 : 360 : 0, small: 0, floor: 0, broken: 0, discard: 0 }, mortality: date === today ? 2 : 0, feed: { itemReference: feed.id, locationReference: String(store._id), bags: 0, bagSizeKg: 50, additionalKg: 10 }, waterLitres: 100, lightHours: 16, observations: 'SAMPLE DATA ONLY — university demonstration.', postMortem: 'Sample observation only; no diagnosis or treatment recommendation.' } });
      const saved = await reports.saveReport(actor, null, input, request);
      if (date === today && index === 0) {
        const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1cAAAAASUVORK5CYII=', 'base64');
        await evidence.upload(actor, 'report', saved.id, image, 'image/png', { name: 'sample-placeholder.png', purpose: 'post-mortem' }, config, request);
        await evidence.comment(actor, 'report', saved.id, 'One-pixel sample attachment only; not a clinical photograph.', request);
      }
      await reports.transition(actor, saved.id, { version: saved.version, reason: '' }, 'submit', request);
    }
    if (!await BirdMeasurement.exists({ flockId: flock._id, businessDate: today, notes: 'Sample measurement — demonstration only' })) await reports.createMeasurement(actor, { flockId: String(flock._id), measuredAt: new Date(Date.now() - 1000).toISOString(), sampleSize: 10, averageWeight: 1.6, unit: 'kg', notes: 'Sample measurement — demonstration only' }, request);
  }
  const farmId = String(farms[0]._id); const flock = await H.flock.findOne({ farmId }); const eggPolicy = await commerce.policy(actor, farmId);
  const sale = await commerce.createSale(actor, parse(commerceInputs.saleInput, { farmId, locationId: eggPolicy.locationId, businessDate: today, buyer: 'Demo buyer — sample only', reference: `DEMO-SALE-${today}`, lines: [{ key: 'standard', category: 'standard', quantity: 1, unit: 'peti', unitPrice: '18000' }] }), `demo-sale-v1-${today}`, request);
  await commerce.createExpense(actor, parse(commerceInputs.expenseInput, { farmId, businessDate: today, category: 'electricity', amount: '7000', reference: `DEMO-EXPENSE-${today}`, description: 'Sample entered expense, not real accounting' }), `demo-expense-v1-${today}`, request);
  const logical = await FeedFormula.findOne({ farmId, code: `DEMO-${today}` });
  if (!logical) {
    let formula = await formulas.save(actor, null, parse(formulaInputs.create, { farmId, code: `DEMO-${today}`, name: 'Demonstration formula — sample only', businessDate: today, rows: [{ key: 'maize', itemId: maize.id, kg: '60' }, { key: 'soy', itemId: soy.id, kg: '40' }] }), `demo-formula-v1-${today}`, request);
    formula = await formulas.transition(actor, formula.id, { version: formula.version }, 'submit', null, request);
    formula = await formulas.transition(actor, formula.id, parse(formulaInputs.pricing, { version: formula.version, rates: [{ key: 'maize', rate: '10' }, { key: 'soy', rate: '20' }] }), 'pricing', null, request);
    await formulas.transition(actor, formula.id, { version: formula.version }, 'finalize', null, request);
  }
  if (!await ClinicalVisit.exists({ flockId: flock._id, businessDate: today, diagnosis: 'SAMPLE ONLY — no clinical diagnosis' })) {
    const visit = await clinical.saveVisit(actor, null, parse(clinicalInputs.visitInput, { flockId: String(flock._id), occurredAt: new Date(Date.now() - 1000).toISOString(), diagnosis: 'SAMPLE ONLY — no clinical diagnosis', observations: 'Owner-entered training record; not a Doctor consultation.' }), request);
    const prescription = await clinical.savePrescription(actor, null, visit.id, parse(clinicalInputs.prescriptionData, { items: ['a', 'b'].map((key) => ({ key, medicine: `Sample item ${key} — not a treatment`, instructions: 'Training data only. Do not administer.', route: 'water', startDate: today, durationDays: 3, times: ['00:00', '18:00'] })) }), request);
    await clinical.finalize(actor, prescription.id, { version: prescription.version, reason: '' }, request);
  }
  if (!await Notification.exists({ farmId, kind: 'medical', businessDate: today, title: 'Sample medical alert — demonstration only' })) await alerts.raise(actor, { farmId, title: 'Sample medical alert — demonstration only', message: 'Training workflow; not a real medical emergency or treatment request.', severity: 'warning' }, request);
  await runReminders(config);
  return { businessDate: today, accounts, saleId: sale.id, note: 'Sample records are attributed to the Owner running this explicit CLI. Existing records, passwords and completed workflow changes are preserved.' };
}
