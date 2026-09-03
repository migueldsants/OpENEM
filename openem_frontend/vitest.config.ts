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
    // Ignora sandboxes do Stryker e dist.
    exclude: ['**/node_modules/**', '**/dist/**', '**/.stryker-tmp/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Ignora bootstrap, tipos e setup — cobertura de código real.
      exclude: [
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/test/**',
        'src/**/*.d.ts',
        'dist/**',
        'node_modules/**',
      ],
      thresholds: {
        statements: 25,
        branches: 20,
        functions: 18,
        lines: 25,
      },
    },
  },
});