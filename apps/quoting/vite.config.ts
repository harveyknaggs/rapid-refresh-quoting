import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // allow importing workspace package source (TS) that lives above the app dir
  server: { fs: { allow: ['../..'] } },
  base: './',
});
