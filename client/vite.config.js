import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The proxy means C never thinks about CORS in dev: fetch('/api/health') just
// works and hits B's Express server on :4000.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // React and the router change far less often than the app, so they
        // get a file of their own that stays cached across deploys.
        manualChunks(id) {
          if (
            /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler|@remix-run)[\\/]/.test(
              id
            )
          ) {
            return 'react';
          }
          return undefined;
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
