// API is the default; selecting the historical mock demo must be explicit.
const dataMode = import.meta.env.VITE_DATA_MODE || 'api';
if (!['api', 'mock'].includes(dataMode)) throw new Error('VITE_DATA_MODE must be api or mock.');
export const config = {
  appName: import.meta.env.VITE_APP_NAME || 'LayerFlow',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  dataMode,
  isMock: dataMode === 'mock',
  isDev: import.meta.env.DEV,
};
