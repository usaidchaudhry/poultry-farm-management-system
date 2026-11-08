import { ROLE_PERMISSIONS } from '../../config/roles.js';
import { ApiError } from '../apiError.js';
import { delay } from './delay.js';
import { toPublicUser, usersStore } from './mockUsersStore.js';

// The user object the app keeps in memory after sign-in. A real API returns the same shape,
// including the permission codes that drive menus and buttons.
export function toSessionUser(record) {
  const { id, name, email, role, isActive } = toPublicUser(record);
  return { id, name, email, role, isActive, permissions: role ? ROLE_PERMISSIONS[role] || [] : [] };
}

export const mockAuthService = {
  async login({ email, password }) {
    await delay(500);
    const record = usersStore.findByEmail(email);
    if (!record || record.password !== password) {
      throw new ApiError('Invalid email or password.', { code: 'INVALID_CREDENTIALS', status: 401 });
    }
    if (!record.isActive) {
      throw new ApiError('This account has been deactivated. Contact the Owner.', { code: 'ACCOUNT_INACTIVE', status: 403 });
    }
    usersStore.update(record.id, { lastLoginAt: new Date().toISOString() });
    return { user: toSessionUser(record), token: `mock-token-${record.id}-${Date.now()}` };
  },

  async getCurrentUser(userId) {
    await delay(250);
    const record = usersStore.findById(userId);
    if (!record || !record.isActive) {
      throw new ApiError('Your session is no longer valid.', { code: 'SESSION_INVALID', status: 401 });
    }
    return toSessionUser(record);
  },

  async logout() {
    await delay(100);
  },
};
