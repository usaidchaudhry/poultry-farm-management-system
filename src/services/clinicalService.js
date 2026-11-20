import api from './api.js';
export const clinicalService = {
  async list(query) { return (await api.get('/clinical-visits', { params: query })).data; },
  async detail(id) { return (await api.get(`/clinical-visits/${id}`)).data.data; },
  async saveVisit(record, input) { return (await (record ? api.patch(`/clinical-visits/${record.id}`, { ...input, version: record.version }) : api.post('/clinical-visits', input))).data.data; },
  async preview(visitId, items) { return (await api.post(`/clinical-visits/${visitId}/schedule-preview`, { items })).data.data; },
  async savePrescription(record, visitId, items) { return (await (record ? api.patch(`/prescriptions/${record.id}`, { items, version: record.version }) : api.post(`/clinical-visits/${visitId}/prescriptions`, { items }))).data.data; },
  async finalize(record) { return (await api.post(`/prescriptions/${record.id}/finalize`, { version: record.version })).data.data; },
  async cancel(record, reason) { return (await api.post(`/prescriptions/${record.id}/cancel`, { version: record.version, reason })).data.data; },
  async replace(record, items, reason) { return (await api.post(`/prescriptions/${record.id}/replace`, { version: record.version, items, reason })).data.data; },
};
export const medicationService = {
  async list(query) { return (await api.get('/medication-tasks', { params: query })).data; },
  async detail(id) { return (await api.get(`/medication-tasks/${id}`)).data.data; },
  async outcome(record, values, correction = false) { return (await api.post(`/medication-tasks/${record.id}/${correction ? 'corrections' : 'outcomes'}`, { ...values, version: record.version })).data.data; },
};
