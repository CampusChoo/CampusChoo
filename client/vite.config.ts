import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@campuschoo/shared': path.resolve(__dirname, '../shared/types.ts'),
    },
  },
  server: {
    port: 3000,
  },
});
