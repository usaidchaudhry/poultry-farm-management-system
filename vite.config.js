import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server runs on http://localhost:5173
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: false, proxy: { '/api': { target: 'http://127.0.0.1:5000', changeOrigin: false } } },
});
