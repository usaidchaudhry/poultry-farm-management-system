import { Organization, User, AuditEvent } from '../access/models.js';
import { verifyPassword } from './passwords.js';

// Explicit local demonstration accounts only; never disclose bootstrap credentials.
export const DEMO_EMAILS = ['demo-owner@layerflow.test', 'demo-production@layerflow.test', 'demo-alpha@layerflow.test', 'demo-beta@layerflow.test', 'demo-operations@layerflow.test', 'demo-doctor@layerflow.test'];
export async function demoAccounts(config, remoteAddress) {
  if (!config.demoLoginEnabled || config.production || !['127.0.0.1', '::1'].includes(config.host) || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remoteAddress)) return [];
  const organization = await Organization.findOne({ key: 'default' });
  if (!organization || !await AuditEvent.exists({ organizationId: organization._id, action: 'organization.demo-seeded' })) return [];
  const users = await User.find({ organizationId: organization._id, email: { $in: DEMO_EMAILS }, isActive: true }).select('+passwordHash').populate('roleId');
  const byEmail = new Map(users.map((user) => [user.email, user]));
  const rows = [];
  for (const email of DEMO_EMAILS) {
    const user = byEmail.get(email); if (!user?.roleId) continue;
    const password = user.mustChangePassword && await verifyPassword(config.demoPassword, user.passwordHash) ? config.demoPassword : '';
    rows.push({ id: String(user._id), email, name: user.name, roleLabel: user.roleId.name, password });
  }
  return rows;
}
