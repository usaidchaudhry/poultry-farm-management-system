import { AppError, notFound } from '../../lib/errors.js';
import { assertVersion } from '../../lib/validation.js';
import { pageQuery, pageMeta, literalSearch } from '../../lib/pagination.js';
import { User, Role } from '../access/models.js';
import { P } from '../access/catalog.js';
import { publicUser } from '../access/serialization.js';
import { accessTransaction, assertGrantable } from '../access/transactions.js';
import { audit } from '../access/audit.js';
import { hashPassword } from '../auth/passwords.js';

async function targetUser(id, actor, session) {
  const user = await User.findOne({ _id: id, organizationId: actor.organizationId }).select('+authVersion').populate('roleId').session(session);
  if (!user) throw notFound();
  if (user.roleId?.isProtected && !actor.isProtected) throw new AppError(403, 'PROTECTED_ACCOUNT', 'This protected account requires an authorized administrator.');
  // Password reset/email/role changes must not become a way for a delegated
  // administrator to take over an account with stronger grants.
  if (user.roleId) assertGrantable(user.roleId, actor);
  return user;
}

export async function listUsers(actor, query) {
  const page = pageQuery(query, ['name', 'email', 'createdAt']);
  const filter = { organizationId: actor.organizationId };
  if (page.search) filter.$or = [{ name: literalSearch(page.search) }, { email: literalSearch(page.search) }];
  if (page.status) filter.isActive = page.status === 'active';
  if (page.role) {
    if (page.role === 'unassigned') filter.roleId = null;
    else {
      const role = await Role.findOne({ organizationId: actor.organizationId, code: page.role });
      if (!role) return { data: [], meta: pageMeta(page, 0) };
      filter.roleId = role._id;
    }
  }
  const [users, total] = await Promise.all([
    User.find(filter).populate('roleId').sort(page.sort).skip(page.skip).limit(page.pageSize),
    User.countDocuments(filter),
  ]);
  return { data: users.map((user) => publicUser(user)), meta: pageMeta(page, total) };
}

export async function createUser(caller, input, requestId) {
  const passwordHash = await hashPassword(input.password);
  return accessTransaction(caller, [P.USERS_MANAGE], async (session, actor) => {
    const [user] = await User.create([{
      organizationId: actor.organizationId, name: input.name, email: input.email, passwordHash,
      isActive: input.isActive, roleId: null, mustChangePassword: true,
    }], { session });
    const result = publicUser(user);
    await audit(actor, 'user.created', 'user', user._id, { after: result }, requestId, session);
    return result;
  });
}

export async function updateUser(caller, id, input, requestId) {
  return accessTransaction(caller, [P.USERS_MANAGE], async (session, actor) => {
    const user = await targetUser(id, actor, session);
    assertVersion(user, input.version);
    const before = publicUser(user);
    user.name = input.name; user.email = input.email; user.version += 1;
    await user.save({ session });
    const result = publicUser(user);
    await audit(actor, 'user.updated', 'user', id, { before, after: result }, requestId, session);
    return result;
  });
}

export async function assignRole(caller, id, input, requestId) {
  return accessTransaction(caller, [P.USERS_MANAGE], async (session, actor) => {
    if (id === actor.id) throw new AppError(403, 'SELF_CHANGE', 'You cannot change your own role.');
    const user = await targetUser(id, actor, session);
    assertVersion(user, input.version);
    const role = input.roleId ? await Role.findOne({ _id: input.roleId, organizationId: actor.organizationId }).session(session) : null;
    if (input.roleId && !role) throw notFound();
    if (role) assertGrantable(role, actor);
    const before = publicUser(user);
    user.roleId = role; user.authVersion += 1; user.version += 1;
    await user.save({ session });
    const result = publicUser(user);
    await audit(actor, 'user.role-assigned', 'user', id, { before, after: result }, requestId, session);
    return result;
  });
}

export async function setActive(caller, id, input, requestId) {
  return accessTransaction(caller, [P.USERS_MANAGE], async (session, actor) => {
    if (id === actor.id && !input.isActive) throw new AppError(403, 'SELF_CHANGE', 'You cannot deactivate your own account.');
    const user = await targetUser(id, actor, session);
    assertVersion(user, input.version);
    const before = publicUser(user);
    user.isActive = input.isActive; user.authVersion += 1; user.version += 1;
    await user.save({ session });
    const result = publicUser(user);
    await audit(actor, 'user.status-changed', 'user', id, { before, after: result }, requestId, session);
    return result;
  });
}

export async function resetPassword(caller, id, input, requestId) {
  const passwordHash = await hashPassword(input.password);
  return accessTransaction(caller, [P.USERS_MANAGE], async (session, actor) => {
    if (id === actor.id) throw new AppError(403, 'SELF_CHANGE', 'Use Change password for your own account.');
    const user = await targetUser(id, actor, session);
    assertVersion(user, input.version);
    user.passwordHash = passwordHash; user.mustChangePassword = true; user.authVersion += 1; user.version += 1;
    await user.save({ session });
    await audit(actor, 'user.password-reset', 'user', id, { sessionsInvalidated: true }, requestId, session);
    return publicUser(user);
  });
}
