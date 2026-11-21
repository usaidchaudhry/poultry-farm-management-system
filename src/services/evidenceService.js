import api from './api.js';
export const evidenceService = {
  list: async (type, id) => (await api.get(`/evidence/${type}/${id}`)).data.data,
  upload: async (type, id, file, purpose) => (await api.post(`/evidence/${type}/${id}/files`, file, { params: { name: file.name, purpose }, headers: { 'Content-Type': file.type } })).data.data,
  comment: async (type, id, text) => (await api.post(`/evidence/${type}/${id}/comments`, { text })).data.data,
  remove: async (id) => (await api.delete(`/evidence/files/${id}`)).data.data,
  image: async (id) => URL.createObjectURL((await api.get(`/evidence/files/${id}`, { responseType: 'blob' })).data),
};
