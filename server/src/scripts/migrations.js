import { mongoose, transaction } from '../config/database.js';
import { Organization, Role, SecurityGuard, Migration, models } from '../modules/access/models.js';
import { hierarchyModels } from '../modules/organization/models.js';
import { DEFAULT_ROLES } from '../modules/access/catalog.js';
import { reportModels, openingMovement } from '../modules/reports/models.js';
import { clinicalModels } from '../modules/clinical/models.js';

export async function applyMigrations(config) {
  for (const model of [...models, ...Object.values(hierarchyModels), ...reportModels, ...clinicalModels]) {
    try { await model.createCollection(); } catch (error) { if (error.code !== 48) throw error; }
    await model.createIndexes();
  }
  try { await SecurityGuard.updateOne({ _id: 'access-control' }, { $setOnInsert: { revision: 0 } }, { upsert: true }); }
  catch (error) { if (error.code !== 11000) throw error; }
  await transaction(async (session) => {
    await SecurityGuard.updateOne({ _id: 'access-control' }, { $inc: { revision: 1 } }, { session });
    if (await Migration.exists({ _id: '001-identity-foundation' }).session(session)) return;
    const [organization] = await Organization.create([{ name: 'LayerFlow', key: 'default', timezone: config.timezone, currency: 'PKR' }], { session });
    for (const role of DEFAULT_ROLES) await Role.create([{ ...role, organizationId: organization._id }], { session });
    await Migration.create([{ _id: '001-identity-foundation', appliedAt: new Date() }], { session });
  });
  // Collection/index creation above is repeatable, including existing installs.
  await Migration.updateOne({ _id: '002-organization-hierarchy' }, { $setOnInsert: { appliedAt: new Date() } }, { upsert: true });
  await transaction(async (session) => {
    await SecurityGuard.updateOne({ _id: 'access-control' }, { $inc: { revision: 1 } }, { session });
    if (await Migration.exists({ _id: '003-reports-and-population' }).session(session)) return;
    for (const flock of await hierarchyModels.flock.find().session(session)) await openingMovement(flock, session);
    await Migration.create([{ _id: '003-reports-and-population', appliedAt: new Date() }], { session });
  });
  await Migration.updateOne({ _id: '004-clinical-administration' }, { $setOnInsert: { appliedAt: new Date() } }, { upsert: true });
  return mongoose.connection;
}
