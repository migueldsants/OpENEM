import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

// O site é outro projeto, mas a mesma marca: o boot do tema e o ícone vêm do
// app (openem_frontend/public), sem cópia. Assim um tema novo no app chega
// aqui sem ninguém lembrar de copiar arquivo.
const APP_PUBLIC = fileURLToPath(new URL('../openem_frontend/public/', import.meta.url));
const SHARED = ['theme-boot.js', 'icon.svg'];

function assetsDoApp(): Plugin {
  return {
    name: 'openem-assets-do-app',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const nome = req.url?.split('?')[0].slice(1) ?? '';
        if (!SHARED.includes(nome)) return next();
        res.setHeader(
          'Content-Type',
          nome.endsWith('.svg') ? 'image/svg+xml' : 'text/javascript',
        );
        res.end(readFileSync(APP_PUBLIC + nome));
      });
    },
    generateBundle() {
      for (const nome of SHARED) {
        this.emitFile({ type: 'asset', fileName: nome, source: readFileSync(APP_PUBLIC + nome) });
      }
    },
  };
}

// Temas de redação por ano, lidos do catálogo do app no build. O JSON inteiro
// tem textos motivadores e páginas (centenas de KB); a landing só precisa de
// ano, aplicação e tema.
const REDACOES = fileURLToPath(
  new URL('../openem_frontend/src/data/redacoes.json', import.meta.url),
);
const ARQUIVO_ID = 'virtual:arquivo-redacoes';

function arquivoDeRedacoes(): Plugin {
  return {
    name: 'openem-arquivo-redacoes',
    resolveId(id) {
      return id === ARQUIVO_ID ? '\0' + ARQUIVO_ID : undefined;
    },
    load(id) {
      if (id !== '\0' + ARQUIVO_ID) return undefined;
      this.addWatchFile(REDACOES);
      const todas = JSON.parse(readFileSync(REDACOES, 'utf8')) as {
        ano: number;
        aplicacao: string;
        aplicacaoRotulo: string;
        tema: string;
      }[];
      const enxuto = todas.map(({ ano, aplicacao, aplicacaoRotulo, tema }) => ({
        ano,
        aplicacao,
        rotulo: aplicacaoRotulo,
        tema,
      }));
      return `export default ${JSON.stringify(enxuto)};`;
    },
  };
}

// No dev, /docs/qualquer-pagina cai no docs/index.html (no build, o
// prerender grava um HTML por página).
function fallbackDaDocs(): Plugin {
  return {
    name: 'openem-fallback-docs',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url ?? '';
        if (/^\/docs(\/[^.?]*)?(\?.*)?$/.test(url)) req.url = '/docs/index.html';
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), assetsDoApp(), arquivoDeRedacoes(), fallbackDaDocs()],
  server: {
    port: 5174,
    strictPort: true,
    // O CSS do app (tokens, temas, componentes) é importado de ../openem_frontend.
    fs: { allow: ['..'] },
  },
  build: {
    rollupOptions: {
      input: {
        landing: fileURLToPath(new URL('./index.html', import.meta.url)),
        docs: fileURLToPath(new URL('./docs/index.html', import.meta.url)),
      },
    },
  },
});
