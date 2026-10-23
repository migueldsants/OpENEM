import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

/**
 * O /sw.js do site desliga o service worker antigo do app, que morava na raiz
 * (issue #88). Roda o arquivo como o navegador rodaria, com um `self` falso.
 */
const codigo = readFileSync(resolve(__dirname, '../public/sw.js'), 'utf8');

function carregar(cachesExistentes: string[]) {
  const ouvintes = new Map<string, (e: unknown) => void>();
  const apagados: string[] = [];
  const abas = [
    { url: 'https://openem.exemplo/', navigate: vi.fn() },
    { url: 'https://openem.exemplo/docs/', navigate: vi.fn() },
  ];
  const self = {
    addEventListener: (tipo: string, fn: (e: unknown) => void) => ouvintes.set(tipo, fn),
    skipWaiting: vi.fn(),
    registration: { unregister: vi.fn(() => Promise.resolve(true)) },
    clients: { matchAll: vi.fn(() => Promise.resolve(abas)) },
  };
  const caches = {
    keys: () => Promise.resolve(cachesExistentes),
    delete: (nome: string) => {
      apagados.push(nome);
      return Promise.resolve(true);
    },
  };
  const buscados: { url: string; cache?: string }[] = [];
  const fetch = (url: string, init: { cache?: string }) => {
    buscados.push({ url, cache: init.cache });
    return Promise.resolve(new Response(null, { status: 301 }));
  };
  new Function('self', 'caches', 'fetch', codigo)(self, caches, fetch);
  return { ouvintes, self, apagados, abas, buscados };
}

describe('service worker antigo (kill switch)', () => {
  it('instala na hora, sem esperar as abas fecharem', () => {
    const { ouvintes, self } = carregar([]);
    ouvintes.get('install')!({});
    expect(self.skipWaiting).toHaveBeenCalled();
  });

  it('ao ativar, apaga o cache do app antigo, se desregistra e recarrega as abas', async () => {
    const { ouvintes, self, apagados, abas, buscados } = carregar([
      'workbox-precache-v2-https://openem.exemplo/',
      'workbox-precache-v2-https://openem.exemplo/app/',
      'api-cache',
    ]);
    let espera: Promise<unknown> | undefined;
    ouvintes.get('activate')!({ waitUntil: (p: Promise<unknown>) => (espera = p) });
    await espera;

    // Só o precache da raiz: o do app novo (/app/) e os de dados ficam.
    expect(apagados).toEqual(['workbox-precache-v2-https://openem.exemplo/']);
    expect(self.registration.unregister).toHaveBeenCalled();
    // Renova no cache HTTP a página antiga de cada endereço do app.
    expect(buscados.map((b) => b.url)).toContain('/questoes');
    expect(buscados.every((b) => b.cache === 'reload')).toBe(true);
    for (const aba of abas) expect(aba.navigate).toHaveBeenCalledWith(aba.url);
  });

  it('não registra nada que intercepte requisições', () => {
    const { ouvintes } = carregar([]);
    expect(ouvintes.has('fetch')).toBe(false);
  });

  it('renova os mesmos endereços que o nginx redireciona para /app/', () => {
    const nginx = readFileSync(resolve(__dirname, '../../openem_frontend/nginx.conf'), 'utf8');
    const doNginx = /location ~ \^\/\(([^)]+)\)\(\/\.\*\)\?\$/.exec(nginx)?.[1].split('|') ?? [];
    const doSw = [...codigo.matchAll(/^ {2}'\/([a-z-]*)',$/gm)].map(([, r]) => r);
    // /usuarios/:id tem id no caminho: não há um endereço fixo para renovar.
    expect(doSw.filter((r) => r !== '').sort()).toEqual(
      doNginx.filter((r) => r !== 'usuarios').sort(),
    );
    expect(doSw).toContain('');
  });
});
