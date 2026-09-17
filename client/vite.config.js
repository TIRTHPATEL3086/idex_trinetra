import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The proxy means C never thinks about CORS in dev: fetch('/api/health') just
// works and hits B's Express server on :4000.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
