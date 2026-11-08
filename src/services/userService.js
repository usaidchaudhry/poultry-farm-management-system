import { mockUserService } from './mock/mockUserService.js';

// The UI imports ONLY this file for user administration. See the note in authService.js.
export const userService = {
  listUsers: () => mockUserService.listUsers(),
  createUser: (data) => mockUserService.createUser(data),
  updateUser: (id, data) => mockUserService.updateUser(id, data),
  assignRole: (id, role, options) => mockUserService.assignRole(id, role, options),
  setUserActive: (id, isActive, options) => mockUserService.setUserActive(id, isActive, options),
};
