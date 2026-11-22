import api from './api.js';
export const insightService = {
  catalog: async () => (await api.get('/reports/catalog')).data.data,
  report: async ({ type, ...query }) => (await api.get(`/reports/${type}`, { params: query })).data,
  dashboard: async (query) => { const value = (await api.get('/dashboard', { params: query })).data.data; return { data: Object.entries(value.sections).map(([id, section]) => ({ id, ...section })), meta: value.meta }; },
  export: async (type, query) => (await api.get(`/reports/${type}/export`, { params: { ...query, format: 'csv' }, responseType: 'blob' })).data,
};
