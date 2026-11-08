import { ROLES } from '../../config/roles.js';
import { ApiError } from '../apiError.js';
import { delay } from './delay.js';
import { toPublicUser, usersStore } from './mockUsersStore.js';
import { workService } from '../workService.js';

const VALID_ROLES = Object.values(ROLES);

const isEmailTaken = (email, ignoreId) => {
  const found = usersStore.findByEmail(email);
  return Boolean(found && found.id !== ignoreId);
};

// Rule (a real backend must enforce it too): never leave the system without an active Owner.
function assertNotLastOwner(targetId, message) {
  const target = usersStore.findById(targetId);
  if (!target || target.role !== ROLES.OWNER || !target.isActive) return;
  const otherActiveOwners = usersStore.all().filter((u) => u.id !== targetId && u.role === ROLES.OWNER && u.isActive);
  if (otherActiveOwners.length === 0) throw new ApiError(message, { code: 'LAST_OWNER', status: 409 });
}

function getOrThrow(id) {
  const record = usersStore.findById(id);
  if (!record) throw new ApiError('User not found.', { code: 'NOT_FOUND', status: 404 });
  return record;
}

// `actorId` is the signed-in user. A real API reads it from the auth token instead.
export const mockUserService = {
  async listUsers() {
    await delay(400);
    return usersStore.all().map(toPublicUser);
  },

  async createUser({ name, email, password, role, isActive }, { actorId } = {}) {
    await delay(500);
    if (isEmailTaken(email)) {
      throw new ApiError('Email already in use.', { code: 'EMAIL_TAKEN', status: 409, fieldErrors: { email: 'A user with this email already exists.' } });
    }
    if (role && !VALID_ROLES.includes(role)) throw new ApiError('Unknown role.', { code: 'INVALID_ROLE', status: 400 });
    const record = usersStore.insert({
      id: `u${Date.now()}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role: role || null,
      isActive: Boolean(isActive),
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
    });
    const saved = toPublicUser(record);
    workService.recordAudit({ id: actorId || 'system' }, 'created', 'users', saved);
    return saved;
  },

  async updateUser(id, { name, email }, { actorId } = {}) {
    await delay(500);
    const before = toPublicUser(getOrThrow(id));
    if (isEmailTaken(email, id)) {
      throw new ApiError('Email already in use.', { code: 'EMAIL_TAKEN', status: 409, fieldErrors: { email: 'A user with this email already exists.' } });
    }
    const saved = toPublicUser(usersStore.update(id, { name: name.trim(), email: email.trim().toLowerCase() }));
    workService.recordAudit({ id: actorId || 'system' }, 'updated', 'users', saved, before);
    return saved;
  },

  async assignRole(id, role, { actorId } = {}) {
    await delay(450);
    const before = toPublicUser(getOrThrow(id));
    if (id === actorId) throw new ApiError('You cannot change your own role.', { code: 'SELF_CHANGE', status: 403 });
    if (role && !VALID_ROLES.includes(role)) throw new ApiError('Unknown role.', { code: 'INVALID_ROLE', status: 400 });
    if (role !== ROLES.OWNER) assertNotLastOwner(id, 'The last active Owner cannot be moved to another role.');
    const saved = toPublicUser(usersStore.update(id, { role: role || null }));
    workService.recordAudit({ id: actorId || 'system' }, 'changed role', 'users', saved, before);
    return saved;
  },

  async setUserActive(id, isActive, { actorId } = {}) {
    await delay(450);
    const before = toPublicUser(getOrThrow(id));
    if (id === actorId && !isActive) throw new ApiError('You cannot deactivate your own account.', { code: 'SELF_CHANGE', status: 403 });
    if (!isActive) assertNotLastOwner(id, 'The last active Owner cannot be deactivated.');
    const saved = toPublicUser(usersStore.update(id, { isActive }));
    workService.recordAudit({ id: actorId || 'system' }, isActive ? 'activated' : 'deactivated', 'users', saved, before);
    return saved;
  },
};
