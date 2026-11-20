import { hierarchyModels as M } from './models.js';
import { Organization, User } from '../access/models.js';
import { accessTransaction, assertGrantable } from '../access/transactions.js';
import { audit } from '../access/audit.js';
import { assertVersion } from '../../lib/validation.js';
import { AppError, notFound, denied } from '../../lib/errors.js';
import { P } from '../access/catalog.js';

export const kinds = ['site', 'farm', 'house', 'flock'];
const parentKind = (kind) => kinds[kinds.indexOf(kind) - 1];
export function publicEntity(record) {
  const { _id, organizationId, nameKey, ...data } = record.toObject();
  for (const key of ['siteId', 'farmId', 'houseId']) if (data[key]) data[key] = String(data[key]);
  return { id: String(_id), ...data };
}

// Site grants include future farms. A farm grant reveals its ancestor site,
// but never grants access to that site's sibling farms.
export async function scopeFilter(actor, kind, session = null) {
  const filter = { organizationId: actor.organizationId };
  if (actor.scopeMode === 'company') return filter;
  if (kind === 'site') {
    const farms = await M.farm.find({ organizationId: actor.organizationId, _id: { $in: actor.farmIds } }).select('siteId').session(session);
    filter._id = { $in: [...actor.siteIds, ...farms.map((f) => f.siteId)] };
  } else filter.$or = [{ siteId: { $in: actor.siteIds } }, { [kind === 'farm' ? '_id' : 'farmId']: { $in: actor.farmIds } }];
  return filter;
}
export async function entity(actor, kind, id, session = null, writing = false) {
  const filter = await scopeFilter(actor, kind, session);
  // A visible ancestor is not itself an assigned resource for mutation.
  if (writing && kind === 'site' && actor.scopeMode !== 'company') filter._id = { $in: actor.siteIds };
  const record = await M[kind].findOne({ $and: [filter, { _id: id }] }).session(session);
  if (!record) throw notFound();
  return record;
}
export async function hierarchy(actor) {
  const output = {};
  for (const kind of kinds) output[`${kind}s`] = (await M[kind].find(await scopeFilter(actor, kind)).sort({ nameKey: 1 })).map(publicEntity);
  const company = await Organization.findById(actor.organizationId);
  return { company: { id: String(company._id), name: company.name }, ...output };
}
async function activeParent(actor, kind, parentId, session) {
  const parent = parentKind(kind);
  if (!parent) return null;
  const record = await entity(actor, parent, parentId, session, true);
  if (record.status !== 'active') throw new AppError(409, 'ARCHIVED_PARENT', 'Restore the parent before using this record.');
  return record;
}
export async function mutate(caller, kind, id, input, requestId, action) {
  return accessTransaction(caller, [P.ORGANIZATION_MANAGE], async (session, actor) => {
    let record; let before = null;
    if (action === 'create') {
      if (kind === 'site' && actor.scopeMode !== 'company') throw denied();
      const parent = parentKind(kind);
      const ancestor = await activeParent(actor, kind, input[`${parent}Id`], session);
      const data = { ...input, organizationId: actor.organizationId };
      if (ancestor) for (const level of kinds.slice(0, kinds.indexOf(kind))) data[`${level}Id`] = level === parent ? ancestor._id : ancestor[`${level}Id`];
      record = new M[kind](data);
    } else {
      record = await entity(actor, kind, id, session, true);
      assertVersion(record, input.version); before = publicEntity(record);
      if (action === 'status') {
        if (input.archived) {
          const child = kinds[kinds.indexOf(kind) + 1];
          if (child && await M[child].exists({ [`${kind}Id`]: record._id, status: 'active' }).session(session)) throw new AppError(409, 'ACTIVE_CHILDREN', 'Archive active children first.');
        } else await activeParent(actor, kind, record[`${parentKind(kind)}Id`], session);
        record.status = input.archived ? 'archived' : 'active';
      } else {
        const { version, ...values } = input;
        Object.assign(record, values);
      }
      record.version += 1;
    }
    record.nameKey = record.name.normalize('NFKC').toLowerCase();
    if (kind === 'flock' && record.status === 'active') {
      const house = await activeParent(actor, kind, record.houseId, session);
      if (house.capacity && record.initialCount > house.capacity) throw new AppError(422, 'CAPACITY_EXCEEDED', 'Birds placed exceed house capacity.');
    }
    if (kind === 'house' && record.capacity) {
      const flock = await M.flock.findOne({ houseId: record._id, status: 'active' }).session(session);
      if (flock && flock.initialCount > record.capacity) throw new AppError(422, 'CAPACITY_EXCEEDED', 'Capacity is below the active flock placement count.');
    }
    await record.save({ session });
    const after = publicEntity(record);
    await audit(actor, `organization.${kind}.${action}`, kind, record._id, { before, after }, requestId, session);
    return after;
  }, { companyOnly: false });
}
export async function assignments(actor) {
  const users = await User.find({ organizationId: actor.organizationId });
  return Object.fromEntries(users.map((u) => [String(u._id), { siteIds: u.siteIds.map(String), farmIds: u.farmIds.map(String), version: u.version }]));
}
export async function assign(caller, id, input, requestId) {
  return accessTransaction(caller, [P.USERS_MANAGE, P.ORGANIZATION_MANAGE], async (session, actor) => {
    const user = await User.findOne({ _id: id, organizationId: actor.organizationId }).select('+authVersion').populate('roleId').session(session);
    if (!user) throw notFound();
    if (user.roleId) assertGrantable(user.roleId, actor);
    if (!user.roleId || user.roleId.scopeMode === 'company') throw new AppError(422, 'SCOPE_NOT_APPLICABLE', 'Assign a role with assigned scope first.');
    assertVersion(user, input.version);
    for (const kind of ['site', 'farm']) {
      const ids = input[`${kind}Ids`];
      const records = await M[kind].find({ _id: { $in: ids }, organizationId: actor.organizationId, status: 'active' }).session(session);
      if (records.length !== ids.length) throw new AppError(422, 'INVALID_SCOPE', 'Assignments must reference active records in this organization.');
      if (kind === 'farm') for (const farm of records) {
        if (!await M.site.exists({ _id: farm.siteId, status: 'active' }).session(session)) throw new AppError(422, 'INVALID_SCOPE', 'The farm site must be active.');
      }
    }
    const before = { siteIds: user.siteIds.map(String), farmIds: user.farmIds.map(String) };
    user.siteIds = input.siteIds; user.farmIds = input.farmIds; user.authVersion += 1; user.version += 1;
    await user.save({ session });
    const after = { siteIds: input.siteIds, farmIds: input.farmIds, version: user.version };
    await audit(actor, 'user.scope-assigned', 'user', id, { before, after }, requestId, session);
    return after;
  });
}
