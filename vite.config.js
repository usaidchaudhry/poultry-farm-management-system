import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server runs on http://localhost:5173
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const dataMode = process.env.VITE_DATA_MODE || env.VITE_DATA_MODE || 'api';
  if (mode === 'production' && dataMode !== 'api') throw new Error('Production submission builds require VITE_DATA_MODE=api. Use npm run dev for the historical mock demo.');
  return { plugins: [react()], define: { 'import.meta.env.VITE_DATA_MODE': JSON.stringify(dataMode) }, server: { port: 5173, open: false, proxy: { '/api': { target: 'http://127.0.0.1:5000', changeOrigin: false } } } };
});
