import { AppError, notFound } from '../../lib/errors.js';
import { assertVersion } from '../../lib/validation.js';
import { Role } from '../access/models.js';
import { P } from '../access/catalog.js';
import { publicRole } from '../access/serialization.js';
import { accessTransaction, assertGrantable } from '../access/transactions.js';
import { audit } from '../access/audit.js';

export async function listRoles(actor) {
  const roles = await Role.find({ organizationId: actor.organizationId }).sort('name');
  return roles.map(publicRole);
}

export async function saveRole(caller, id, input, requestId) {
  return accessTransaction(caller, [P.ROLES_MANAGE], async (session, actor) => {
    let role;
    let before = null;
    if (id) {
      role = await Role.findOne({ _id: id, organizationId: actor.organizationId }).session(session);
      if (!role) throw notFound();
      if (role.isProtected) throw new AppError(403, 'PROTECTED_ROLE', 'The bootstrap recovery role cannot be edited. Create another role instead.');
      assertGrantable(role, actor);
      assertVersion(role, input.version);
      before = publicRole(role);
    }
    assertGrantable({ ...input, isProtected: false }, actor);
    if (!role) role = new Role({ organizationId: actor.organizationId, code: input.code });
    role.name = input.name; role.description = input.description; role.permissions = [...new Set(input.permissions)]; role.scopeMode = input.scopeMode;
    if (id) role.version += 1;
    await role.save({ session });
    const after = publicRole(role);
    await audit(actor, id ? 'role.updated' : 'role.created', 'role', role._id, { before, after }, requestId, session);
    return after;
  });
}
