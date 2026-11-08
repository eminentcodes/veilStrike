import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    port: 5173,
    watch: { ignored: ['**/dist-types/**', '**/*.tsbuildinfo'] },
    host: '0.0.0.0',
    proxy: { '/duel': { target: 'ws://127.0.0.1:8787', ws: true }, '/health': { target: 'http://127.0.0.1:8787' } },
  },
  preview: { port: 4173 },
});

