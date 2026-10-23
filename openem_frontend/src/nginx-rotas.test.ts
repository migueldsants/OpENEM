import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * O app saiu da raiz para /app/ (issue #88). Os endereços antigos
 * (/questoes, /simulados...) redirecionam com 301 no nginx; a lista lá tem de
 * acompanhar as rotas do App.tsx, senão um link antigo cai na landing com 404.
 */
const nginx = readFileSync(resolve(__dirname, '../nginx.conf'), 'utf8');
const app = readFileSync(resolve(__dirname, 'App.tsx'), 'utf8');

const redirecionadas =
  /location ~ \^\/\(([^)]+)\)\(\/\.\*\)\?\$ \{\s*return 301 \/app\$request_uri;/
    .exec(nginx)?.[1]
    .split('|') ?? [];

/** Primeiro segmento de cada rota do app ("/usuarios/:id" → "usuarios"). */
const rotasDoApp = [
  ...new Set(
    [...app.matchAll(/path="\/([a-z-]+)/g)].map(([, segmento]) => segmento),
  ),
];

describe('nginx — endereços antigos do app', () => {
  it('a regra de 301 existe', () => {
    expect(redirecionadas.length).toBeGreaterThan(10);
  });

  it('toda rota do App.tsx redireciona para /app/', () => {
    expect(rotasDoApp.length).toBeGreaterThan(10);
    for (const rota of rotasDoApp) {
      expect(redirecionadas, rota).toContain(rota);
    }
  });

  it('não sequestra as rotas do site, da API nem do app novo', () => {
    for (const daRaiz of ['app', 'docs', 'api', 'media', 'health']) {
      expect(redirecionadas).not.toContain(daRaiz);
    }
  });

  it('o app tem fallback de SPA para o próprio index.html', () => {
    expect(nginx).toContain('try_files $uri $uri/ /app/index.html;');
  });

  it('HTML sai com no-cache no app e no site, e os assets não', () => {
    expect(nginx).toMatch(/~\^text\/html no-cache;/);
    expect(nginx.match(/add_header Cache-Control \$cache_do_html always;/g)).toHaveLength(2);
  });

  it('o site serve as páginas pré-renderizadas e responde 404 no resto', () => {
    expect(nginx).toContain('try_files $uri $uri/index.html $uri/ =404;');
  });
});
