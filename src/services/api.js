import axios from 'axios';
import { config } from '../utils/config.js';
import { ApiError } from './apiError.js';

const api = axios.create({ baseURL: config.apiBaseUrl, timeout: 15000, withCredentials: true });
let csrfToken;
let csrfRequest;
export const setCsrfToken = (token) => { csrfToken = token; };

api.interceptors.request.use(async (request) => {
  if (!['get', 'head', 'options'].includes(request.method || 'get')) {
    if (!csrfToken) {
      csrfRequest ||= api.get('/auth/csrf').then(({ data }) => { csrfToken = data.data.csrfToken; }).finally(() => { csrfRequest = null; });
      await csrfRequest;
    }
    request.headers['X-CSRF-Token'] = csrfToken;
  }
  return request;
});

api.interceptors.response.use((response) => response, (error) => {
  const body = error.response?.data;
  const status = error.response?.status;
  const url = error.config?.url || '';
  if (body?.code === 'CSRF_INVALID') csrfToken = undefined;
  if (status === 401 && !['/auth/login', '/auth/me'].includes(url)) {
    csrfToken = undefined;
    window.dispatchEvent(new Event('layerflow:session-expired'));
  }
  if (status === 403 && url !== '/auth/me') window.dispatchEvent(new Event('layerflow:access-changed'));
  return Promise.reject(new ApiError(body?.message || 'Could not reach the API. Check your connection and try again.', {
    code: body?.code || 'NETWORK_ERROR', status, fieldErrors: body?.fieldErrors,
  }));
});
export default api;
