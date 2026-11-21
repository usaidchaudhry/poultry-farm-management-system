import api from './api.js';
export const inventoryService = {
  async list(kind, query) { return (await api.get(`/inventory/${kind}`, { params: query })).data; },
  async feedOptions(flockId, page = 1) { return (await api.get(`/inventory/feed-options/${flockId}`, { params: { page, pageSize: 100 } })).data.data; },
  async save(kind, record, input) { return (await (record ? api.patch(`/inventory/${kind}/${record.id}`, { ...input, version: record.version }) : api.post(`/inventory/${kind}`, input))).data.data; },
  async post(input, key) { return (await api.post('/inventory/movements', input, { headers: { 'Idempotency-Key': key } })).data.data; },
  async reverse(id, input, key) { return (await api.post(`/inventory/movements/${id}/reverse`, input, { headers: { 'Idempotency-Key': key } })).data.data; },
  async threshold(input) { return (await api.put('/inventory/thresholds', input)).data.data; },
};
