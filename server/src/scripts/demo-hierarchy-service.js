import { transaction } from '../config/database.js';
import { parse, password } from '../lib/validation.js';
import { AppError } from '../lib/errors.js';
import { Organization, Role, User, SecurityGuard } from '../modules/access/models.js';
import { hierarchyModels as H } from '../modules/organization/models.js';
import { hashPassword } from '../modules/auth/passwords.js';
import { audit } from '../modules/access/audit.js';
import { openingMovement } from '../modules/reports/models.js';

// Explicit, optional demonstration fixture. Never resets an existing hierarchy
// or account and never ships a default password.
export async function seedDemoHierarchy(temporaryPassword) {
  const passwordHash = await hashPassword(parse(password, temporaryPassword));
  return transaction(async (session) => {
    await SecurityGuard.updateOne({ _id: 'access-control' }, { $inc: { revision: 1 } }, { session });
    const organization = await Organization.findOne({ key: 'default' }).session(session);
    const role = await Role.findOne({ organizationId: organization._id, code: 'farm_manager', scopeMode: 'assigned' }).session(session);
    const ownerRole = await Role.findOne({ organizationId: organization._id, isProtected: true }).session(session);
    const owner = ownerRole && await User.findOne({ organizationId: organization._id, roleId: ownerRole._id, isActive: true }).session(session);
    if (!role || !owner) throw new AppError(409, 'DEMO_PREREQUISITES', 'Bootstrap an Owner and retain an assigned-scope Farm Manager role first.');
    if (await H.site.exists({ organizationId: organization._id }).session(session) || await User.exists({ email: { $in: ['demo-alpha@layerflow.test', 'demo-beta@layerflow.test'] } }).session(session)) throw new AppError(409, 'DEMO_EXISTS', 'Demo seeding requires an empty hierarchy and unused demo email addresses. Existing records were preserved.');
    const [site] = await H.site.create([{ organizationId: organization._id, name: 'Demo North Site', nameKey: 'demo north site', location: 'Lahore' }], { session });
    const output = [];
    for (const suffix of ['Alpha', 'Beta']) {
      const common = { organizationId: organization._id, siteId: site._id };
      const [farm] = await H.farm.create([{ ...common, name: `Demo Farm ${suffix}`, nameKey: `demo farm ${suffix.toLowerCase()}` }], { session });
      const [house] = await H.house.create([{ ...common, farmId: farm._id, name: `Demo House ${suffix}`, nameKey: `demo house ${suffix.toLowerCase()}`, capacity: 1000 }], { session });
      const [flock] = await H.flock.create([{ ...common, farmId: farm._id, houseId: house._id, name: `Demo Layer ${suffix}`, nameKey: `demo layer ${suffix.toLowerCase()}`, birdType: 'Layer', placementDate: '2026-11-01', initialCount: 500 }], { session });
      await openingMovement(flock, session);
      const email = `demo-${suffix.toLowerCase()}@layerflow.test`;
      const [user] = await User.create([{ organizationId: organization._id, name: `Demo Manager ${suffix}`, email, passwordHash, roleId: role._id, farmIds: [farm._id], mustChangePassword: true }], { session });
      output.push({ email, farmId: String(farm._id), userId: String(user._id) });
    }
    await audit({ id: String(owner._id), organizationId: String(organization._id) }, 'organization.demo-seeded', 'site', site._id, { accounts: output, source: 'explicit-development-cli' }, 'demo-hierarchy', session);
    return output;
  });
}
