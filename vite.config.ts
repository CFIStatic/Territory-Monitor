import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5173, host: true },
  build: { outDir: 'dist', chunkSizeWarningLimit: 2000 },
  // data/generated is served as static JSON via the public dir symlink-free copy
  publicDir: 'public',
});
