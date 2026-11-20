import { transaction } from '../../config/database.js';
import { AppError, denied } from '../../lib/errors.js';
import { SecurityGuard, User, Role } from './models.js';
import { actorFrom } from './serialization.js';
import { RECOVERY_PERMISSIONS } from './catalog.js';

// All identity/access mutations serialize on this document. This also protects
// against concurrent role edits and user deactivations removing every admin.
export async function accessTransaction(caller, required, work, { allowTemporaryPassword = false } = {}) {
  return transaction(async (session) => {
    await SecurityGuard.findOneAndUpdate({ _id: 'access-control' }, { $inc: { revision: 1 } }, { session });
    const user = await User.findById(caller.id).select('+authVersion').populate('roleId').session(session);
    if (!user?.isActive || user.authVersion !== caller.authVersion) throw new AppError(401, 'SESSION_INVALID', 'Sign in to continue.');
    const actor = actorFrom(user);
    if (!allowTemporaryPassword && actor.mustChangePassword) throw new AppError(403, 'PASSWORD_CHANGE_REQUIRED', 'Change your temporary password first.');
    if (required.length && (actor.scopeMode !== 'company' || !required.every((code) => actor.permissions.includes(code)))) throw denied();
    const result = await work(session, actor, user);
    await assertAdministratorRemains(actor.organizationId, session);
    return result;
  });
}

export async function assertAdministratorRemains(organizationId, session) {
  const roles = await Role.find({ organizationId, scopeMode: 'company' }).session(session);
  const recoveryRoleIds = roles.filter((role) => RECOVERY_PERMISSIONS.every((code) => role.permissions.includes(code))).map((role) => role._id);
  const administrator = await User.exists({ organizationId, isActive: true, roleId: { $in: recoveryRoleIds } }).session(session);
  if (!administrator) throw new AppError(409, 'LAST_ADMINISTRATOR', 'At least one active administrator with user and role recovery access must remain.');
}

export function assertGrantable(role, actor) {
  if (role.isProtected && !actor.isProtected) throw denied();
  if (role.permissions.some((code) => !actor.permissions.includes(code)) || (role.scopeMode === 'company' && actor.scopeMode !== 'company')) throw new AppError(403, 'GRANT_FORBIDDEN', 'You cannot grant access that you do not hold.');
}
