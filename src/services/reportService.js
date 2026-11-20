import api from './api.js';
export const reportService = {
  async list(query, mortality = false) { return (await api.get(mortality ? '/mortality' : '/daily-reports', { params: query })).data; },
  async detail(id) { return (await api.get(`/daily-reports/${id}`)).data.data; },
  async save(record, input) { return (await (record ? api.patch(`/daily-reports/${record.id}`, { data: input.data, version: record.version, reason: input.reason }) : api.post('/daily-reports', input))).data.data; },
  async transition(record, action, reason) { return (await api.post(`/daily-reports/${record.id}/${action}`, { version: record.version, reason })).data.data; },
  async population(flockId, date) { return (await api.get(`/flocks/${flockId}/population`, { params: { date } })).data.data; },
  async movement(flockId, values) { return (await api.post(`/flocks/${flockId}/population-adjustments`, values)).data.data; },
};
export const measurementService = {
  async list(query) { return (await api.get('/bird-measurements', { params: query })).data; },
  async create(input) { return (await api.post('/bird-measurements', input)).data.data; },
};
