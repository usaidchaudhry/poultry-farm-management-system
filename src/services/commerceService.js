import api from './api.js';
export const commerceService = {
  async production(query) { return (await api.get('/egg-production', { params: query })).data; },
  async stock(farmId) { return (await api.get(`/egg-production/farms/${farmId}/stock`)).data; },
  async policy(farmId, input) { return (await api.put(`/egg-production/farms/${farmId}/policy`, input)).data.data; },
  async backfill(reportId, reason) { return (await api.post(`/egg-production/${reportId}/backfill`, { reason })).data.data; },
  async sales(query) { return (await api.get('/sales', { params: query })).data; },
  async expenses(query) { return (await api.get('/expenses', { params: query })).data; },
  async finance(query) { return (await api.get('/finance', { params: query })).data; },
  async sources(query) { return (await api.get('/finance/sources', { params: query })).data; },
  async detail(kind, id) { return (await api.get(`/${kind}/${id}`)).data.data; },
  async create(kind, input, key) { return (await api.post(`/${kind}`, input, { headers: { 'Idempotency-Key': key } })).data.data; },
  async action(kind, record, action, input = {}, key) { return (await api.post(`/${kind}/${record.id}/${action}`, { version: record.version, ...input }, { headers: key ? { 'Idempotency-Key': key } : {} })).data.data; },
};
