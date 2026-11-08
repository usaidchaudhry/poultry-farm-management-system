// Single place to read environment variables (Vite exposes only VITE_* keys).
export const config = {
  appName: import.meta.env.VITE_APP_NAME || 'Poultry Management System',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  isDev: import.meta.env.DEV,
};
