import api from './api.js';
import { config } from '../utils/config.js';
import { ROLE_INFO, ROLE_PERMISSIONS, ROLE_SCOPE } from '../config/roles.js';
import { ALL_PERMISSIONS } from '../config/permissions.js';

export const roleService = {
  async listRoles() {
    if (config.isMock) return Object.entries(ROLE_INFO).map(([code, info]) => ({ id: code, code, name: info.label, description: info.description, permissions: ROLE_PERMISSIONS[code], scopeMode: ROLE_SCOPE[code] === 'all' ? 'company' : 'assigned' }));
    return (await api.get('/roles')).data.data;
  },
  async permissions() { return config.isMock ? ALL_PERMISSIONS : (await api.get('/permissions')).data.data; },
  async createRole(values) { return (await api.post('/roles', values)).data.data; },
  async updateRole(id, values) { return (await api.patch(`/roles/${id}`, values)).data.data; },
};
