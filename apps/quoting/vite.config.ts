import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // allow importing workspace package source (TS) that lives above the app dir
  server: {
    fs: { allow: ['../..'] },
    // In dev (npm run dev), forward the AI proxy call to the local node server
    // (npm start, port 8000). Production serves both from the same origin.
    proxy: { '/api': 'http://localhost:8000' },
  },
  base: './',
});
