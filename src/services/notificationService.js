import api from './api.js';
const changed = () => window.dispatchEvent(new Event('layerflow-notifications-changed'));
export const notificationService = {
  list: async (query) => (await api.get('/notifications', { params: query })).data,
  unread: async () => (await api.get('/notifications/unread')).data.data,
  detail: async (id) => (await api.get(`/notifications/${id}`)).data.data,
  raise: async (input) => { const r = (await api.post('/notifications', input)).data.data; changed(); return r; },
  action: async (row, action, note = '') => { const r = (await api.post(`/notifications/${row.id}/${action}`, action === 'seen' ? {} : { version: row.version, note })).data.data; changed(); return r; },
};
