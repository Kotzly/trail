import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(fileURLToPath(import.meta.url));
const uiRoot = resolve(rootDir, 'src/sidepanel/ui');

export default defineConfig({
  root: uiRoot,
  resolve: {
    alias: {
      '@': uiRoot,
    },
  },
  plugins: [react()],
  base: '',
  build: {
    outDir: resolve(rootDir, 'dist/sidepanel'),
    emptyOutDir: false,
    sourcemap: true,
    target: 'es2022',
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      input: resolve(uiRoot, 'sidepanel.html'),
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('pixi.js')) return 'pixi';
          if (id.includes('lucide')) return 'lucide';
          if (id.includes('minisearch')) return 'search';
          return undefined;
        },
      },
    },
  },
});
