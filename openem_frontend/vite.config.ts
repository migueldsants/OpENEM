import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { API_CACHE } from './src/offline/api-cache';

// O app mora em /app/: a raiz do domínio é do site público (openem_site), e
// /docs/ da documentação. Em dev, o Vite também serve em /app/.
const BASE = '/app/';

// https://vite.dev/config/
export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'OpENEM',
        short_name: 'OpENEM',
        description: 'Preparação gratuita e personalizada para o ENEM',
        // Fundo do tema padrão escuro (o mesmo do meta theme-color do index.html).
        theme_color: '#15111c',
        background_color: '#15111c',
        display: 'standalone',
        start_url: BASE,
        // O service worker e o PWA instalado ficam só em /app/: a landing e a
        // documentação, na mesma origem, não são servidas por ele.
        scope: BASE,
        id: BASE,
        lang: 'pt-BR',
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
        // O three.js (só das simulações 3D, ~250 kB gzip) fica fora do
        // precache: quem nunca abre uma cena 3D não paga o download. Ele entra
        // no cache na primeira vez (regra "three" abaixo) e depois funciona
        // offline.
        globIgnores: ['**/assets/three-*.js'],
        // Cache das respostas da API (issue #42): network-first com fallback
        // ao cache — dados atualizados quando há rede, última versão quando
        // não há. Só GETs de leitura; mutações passam pela fila offline.
        // A exportação dos dados (LGPD) fica de fora: é tudo do aluno num
        // arquivo só, e o cache o guardaria por 7 dias no aparelho.
        runtimeCaching: [
          {
            urlPattern: ({ url, request }) =>
              request.method === 'GET' &&
              url.pathname !== '/api/v1/users/me/export' &&
              (url.pathname.startsWith('/api/') ||
                url.pathname.startsWith('/health')),
            handler: 'NetworkFirst',
            options: {
              cacheName: API_CACHE,
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 300,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 dias
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Imagens das questões oficiais do ENEM. CacheFirst porque o nome
            // do arquivo é um UUID: o conteúdo nunca muda sob o mesmo caminho.
            // Questão com figura sem a figura é questão inutilizável offline.
            urlPattern: ({ url, request }) =>
              request.destination === 'image' &&
              url.pathname.startsWith('/media/enem/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'enem-media',
              expiration: {
                // As ~2.200 imagens do banco não cabem na cota do celular;
                // 400 cobre com folga as questões que o aluno abriu de fato.
                maxEntries: 400,
                maxAgeSeconds: 60 * 60 * 24 * 90,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Figuras dos textos motivadores de redação (public/redacoes). Ficam
            // fora do precache (são megabytes): entram no cache quando o aluno
            // abre o tema, e se renovam se o recorte for refeito.
            urlPattern: ({ url, request }) =>
              request.destination === 'image' &&
              // Literal, não BASE: o Workbox copia esta função para dentro do
              // service worker, onde as variáveis deste arquivo não existem.
              url.pathname.startsWith('/app/redacoes/'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'redacoes-figuras',
              expiration: { maxEntries: 120 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // three.js das simulações 3D (fora do precache, ver globIgnores).
            // O nome tem hash: o conteúdo nunca muda sob o mesmo caminho.
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin &&
              // Literal, não BASE (ver a regra das figuras de redação).
              url.pathname.startsWith('/app/assets/three-'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'three',
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Fontes do próprio app (fontsource, em /app/assets/ com hash no
            // nome). Fora do precache: são dezenas de recortes por alfabeto e
            // o navegador só baixa o que a página usa; o que baixou fica para
            // o uso offline. Sem isto o app offline cai na fonte do sistema.
            urlPattern: ({ url, request, sameOrigin }) =>
              request.destination === 'font' &&
              sameOrigin &&
              // Literal, não BASE (ver a regra das figuras de redação).
              url.pathname.startsWith('/app/assets/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'fontes',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // O Rollup já separa o three.js num chunk só das cenas 3D; aqui ele só
        // ganha um nome fixo ("three-<hash>"), que o service worker reconhece
        // para deixar fora do precache. (manualChunks puxaria o React junto.)
        chunkFileNames: (chunk) =>
          chunk.moduleIds.some((id) => /node_modules[\\/]three[\\/]/.test(id))
            ? 'assets/three-[hash].js'
            : 'assets/[name]-[hash].js',
      },
    },
  },
  server: {
    // Em dev, encaminha chamadas de API para o backend NestJS.
    // Alvo configurável via VITE_PROXY_TARGET (padrão: porta 3000).
    proxy: {
      '/api': process.env.VITE_PROXY_TARGET ?? 'http://localhost:3000',
      '/health': process.env.VITE_PROXY_TARGET ?? 'http://localhost:3000',
      // Imagens das questões oficiais, servidas pelo backend.
      '/media': process.env.VITE_PROXY_TARGET ?? 'http://localhost:3000',
    },
  },
});
