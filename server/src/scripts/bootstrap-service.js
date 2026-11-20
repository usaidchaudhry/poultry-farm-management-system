import { transaction } from '../config/database.js';
import { AppError } from '../lib/errors.js';
import { parse, z, displayName, email, password } from '../lib/validation.js';
import { Organization, Role, User, SecurityGuard } from '../modules/access/models.js';
import { publicUser } from '../modules/access/serialization.js';
import { hashPassword } from '../modules/auth/passwords.js';
import { audit } from '../modules/access/audit.js';

export async function bootstrapOwner(input) {
  input = parse(z.object({ name: displayName, email, password }).strict(), input);
  const passwordHash = await hashPassword(input.password);
  return transaction(async (session) => {
    await SecurityGuard.updateOne({ _id: 'access-control' }, { $inc: { revision: 1 } }, { session });
    if (await User.exists({}).session(session)) throw new AppError(409, 'BOOTSTRAP_CLOSED', 'Bootstrap is closed because a user already exists. Use account administration; bootstrap never resets credentials.');
    const organization = await Organization.findOne({ key: 'default' }).session(session);
    const role = await Role.findOne({ organizationId: organization._id, isProtected: true }).session(session);
    const [user] = await User.create([{
      organizationId: organization._id, name: input.name, email: input.email, passwordHash,
      roleId: role._id, isActive: true, mustChangePassword: true,
    }], { session });
    await audit({ id: String(user._id), organizationId: String(organization._id) }, 'access.bootstrapped', 'user', user._id, { protectedRoleAssigned: true }, 'bootstrap', session);
    await user.populate({ path: 'roleId', options: { session } });
    return publicUser(user);
  });
}
