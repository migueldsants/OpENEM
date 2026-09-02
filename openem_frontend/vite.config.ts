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
      workbox: {
        // App shell offline: navegações caem no index.html mesmo sem rede.
        navigateFallback: 'index.html',
        // Cache das respostas da API (issue #42): network-first com fallback
        // ao cache — dados atualizados quando há rede, última versão quando
        // não há. Só GETs de leitura; mutações passam pela fila offline.
        runtimeCaching: [
          {
            urlPattern: ({ url, request }) =>
              request.method === 'GET' &&
              (url.pathname.startsWith('/api/') ||
                url.pathname.startsWith('/health')),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 300,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 dias
              },
              cacheableResponse: { statuses: [0, 200] },
            },
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
