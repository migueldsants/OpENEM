/// <reference types="vitest/config" />
import { defineConfig, mergeConfig } from 'vite';
import viteConfig from './vite.config';

// Reaproveita o vite.config (plugins de dados do app, como o arquivo de
// redações) e só acrescenta o ambiente de teste.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      exclude: ['**/node_modules/**', '**/dist/**', '**/dist-ssr/**'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        exclude: ['src/**/main.tsx', 'src/entry-server.tsx', 'src/test/**', 'src/**/*.d.ts'],
      },
    },
  }),
);
