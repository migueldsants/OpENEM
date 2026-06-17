import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'OpENEM',
        short_name: 'OpENEM',
        description: 'Preparação gratuita e personalizada para o ENEM',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  server: {
    // Em dev, encaminha chamadas de API para o backend NestJS.
    // Alvo configurável via VITE_PROXY_TARGET (padrão: porta 3000).
    proxy: {
      '/api': process.env.VITE_PROXY_TARGET ?? 'http://localhost:3000',
      '/health': process.env.VITE_PROXY_TARGET ?? 'http://localhost:3000',
    },
  },
});
