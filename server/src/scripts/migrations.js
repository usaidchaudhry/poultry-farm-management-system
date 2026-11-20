import { mongoose, transaction } from '../config/database.js';
import { Organization, Role, SecurityGuard, Migration, models } from '../modules/access/models.js';
import { DEFAULT_ROLES } from '../modules/access/catalog.js';

export async function applyMigrations(config) {
  for (const model of models) {
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
  return mongoose.connection;
}
