import axios from 'axios';
import { config } from '../utils/config.js';

// Shared Axios instance. All future service modules import this instead of calling axios directly.
const api = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Phase 4+ will attach the auth token here once real login exists.
api.interceptors.request.use((request) => request);

api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
);

export default api;
