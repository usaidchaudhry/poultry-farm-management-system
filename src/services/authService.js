import api, { setCsrfToken } from './api.js';
import { config } from '../utils/config.js';
async function mock() { return (await import('./mock/mockAuthService.js')).mockAuthService; }

export const authService = {
  async login(credentials) {
    if (config.isMock) return (await mock()).login(credentials);
    const { data } = await api.post('/auth/login', credentials);
    setCsrfToken(data.data.csrfToken);
    return { user: data.data.user };
  },
  async getCurrentUser(mockUserId) {
    if (config.isMock) return (await mock()).getCurrentUser(mockUserId);
    return (await api.get('/auth/me')).data.data;
  },
  async logout() {
    if (config.isMock) return (await mock()).logout();
    await api.post('/auth/logout'); setCsrfToken(undefined);
  },
  async changePassword(values) {
    const { data } = await api.post('/auth/change-password', values);
    setCsrfToken(data.data.csrfToken);
    return data.data.user;
  },
};
