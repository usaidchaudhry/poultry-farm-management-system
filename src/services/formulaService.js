import api from './api.js';
export const formulaService = {
  async list(query) { return (await api.get('/feed-formulas', { params: query })).data; },
  async detail(id) { return (await api.get(`/feed-formulas/${id}`)).data.data; },
  async ingredients(page = 1) { return (await api.get('/feed-formulas/ingredients', { params: { page, pageSize: 100 } })).data; },
  async save(record, values, key) { return (await (record ? api.patch(`/feed-formulas/${record.id}`, { ...values, version: record.version }) : api.post('/feed-formulas', values, { headers: { 'Idempotency-Key': key } }))).data.data; },
  async preview(record, rates) { return (await api.post(`/feed-formulas/${record.id}/preview`, { version: record.version, rates })).data.data; },
  async pricing(record, rates) { return (await api.put(`/feed-formulas/${record.id}/pricing`, { version: record.version, rates })).data.data; },
  async action(record, action, values = {}, key) { return (await api.post(`/feed-formulas/${record.id}/${action}`, { version: record.version, ...values }, { headers: key ? { 'Idempotency-Key': key } : {} })).data.data; },
};
