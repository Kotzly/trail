import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const uiRoot = resolve(__dirname, 'src/sidepanel/ui');

export default defineConfig({
  root: uiRoot,
  plugins: [react()],
  base: '',
  build: {
    outDir: resolve(__dirname, 'dist/sidepanel'),
    emptyOutDir: false,
    sourcemap: true,
    target: 'es2022',
    rollupOptions: {
      input: resolve(uiRoot, 'sidepanel.html'),
    },
  },
});
