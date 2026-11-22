import api from './api.js';
export const auditService = {
  list: async (query) => (await api.get('/audit-events', { params: query })).data,
  detail: async (id) => (await api.get(`/audit-events/${id}`)).data.data,
};
