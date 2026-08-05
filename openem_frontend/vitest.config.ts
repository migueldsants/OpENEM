/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Config separada para testes — usa jsdom para os testes de componentes.
// (O vite.config.ts principal não é reaproveitado para não herdar o plugin PWA.)
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});