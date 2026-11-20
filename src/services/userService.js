import api from './api.js';
import { config } from '../utils/config.js';
async function mock() { return (await import('./mock/mockUserService.js')).mockUserService; }

export const userService = {
  async listUsers(query = {}) {
    if (config.isMock) return { data: await (await mock()).listUsers(), meta: null };
    return (await api.get('/users', { params: query })).data;
  },
  async createUser(values, options) {
    if (config.isMock) return (await mock()).createUser(values, options);
    const { name, email, password, isActive } = values;
    return (await api.post('/users', { name, email, password, isActive })).data.data;
  },
  async updateUser(id, values, options) {
    if (config.isMock) return (await mock()).updateUser(id, values, options);
    return (await api.patch(`/users/${id}`, { name: values.name, email: values.email, version: options.version })).data.data;
  },
  async assignRole(id, role, options) {
    if (config.isMock) return (await mock()).assignRole(id, role, options);
    return (await api.put(`/users/${id}/role`, { roleId: role || null, version: options.version })).data.data;
  },
  async setUserActive(id, isActive, options) {
    if (config.isMock) return (await mock()).setUserActive(id, isActive, options);
    return (await api.patch(`/users/${id}/status`, { isActive, version: options.version })).data.data;
  },
  async resetPassword(id, password, version) { return (await api.post(`/users/${id}/reset-password`, { password, version })).data.data; },
};
