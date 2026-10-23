import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { embedUrl } from './lib/video';

/**
 * A Content-Security-Policy do app mora no nginx.conf, longe do código que ela
 * precisa liberar. Estes testes seguram os dois juntos: se o app passar a usar
 * outra origem (player, fonte, script), o teste quebra antes do navegador.
 */
const nginx = readFileSync(resolve(__dirname, '../nginx.conf'), 'utf8');
const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');

/** A CSP do bloco `location <alvo> {`. */
function cspDe(alvo: string): string {
  const inicio = nginx.indexOf(`location ${alvo} {`);
  const bloco =
    inicio < 0 ? '' : nginx.slice(inicio, nginx.indexOf('\n  }', inicio));
  return (
    /add_header Content-Security-Policy "([^"]+)" always;/.exec(bloco)?.[1] ??
    ''
  );
}

function diretivaDe(politica: string, nome: string): string[] {
  return (
    politica
      .split(';')
      .map((d) => d.trim().split(/\s+/))
      .find(([n]) => n === nome)
      ?.slice(1) ?? []
  );
}

// O app mora em /app/ (issue #88); a raiz é do site público.
const csp = cspDe('/app/');
const diretiva = (nome: string): string[] => diretivaDe(csp, nome);

describe('CSP do site público (landing e docs)', () => {
  const site = cspDe('/');
  const d = (nome: string) => diretivaDe(site, nome);

  it('existe e é mais fechada que a do app', () => {
    expect(site).not.toBe('');
    expect(site).not.toBe(csp);
  });

  it('só aceita a própria origem: sem vídeo, sem blob e sem fonte de fora', () => {
    expect(d('script-src')).toEqual(["'self'"]);
    expect(d('frame-src')).toEqual([]);
    expect(site).not.toContain('blob:');
    expect(site).not.toContain('youtube');
    expect(site).not.toContain('fonts.g');
    expect(d('frame-ancestors')).toEqual(["'none'"]);
    expect(d('object-src')).toEqual(["'none'"]);
  });
});

describe('CSP do nginx', () => {
  it('existe e vale para o app', () => {
    expect(csp).not.toBe('');
  });

  it("só aceita script da própria origem, sem 'unsafe-inline' nem eval", () => {
    expect(diretiva('script-src')).toEqual(["'self'"]);
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it('não deixa o app ser embutido nem carregar plugin', () => {
    expect(diretiva('frame-ancestors')).toEqual(["'none'"]);
    expect(diretiva('object-src')).toEqual(["'none'"]);
    expect(diretiva('base-uri')).toEqual(["'self'"]);
  });

  it('libera o player de vídeo que a tela Vídeos usa', () => {
    const origem = new URL(embedUrl('abc', null)).origin;
    expect(diretiva('frame-src')).toContain(origem);
  });

  it('libera as fontes externas que o index.html carrega', () => {
    const origens = [...html.matchAll(/href="(https:\/\/[^"]+)"/g)].map(
      (m) => new URL(m[1]).origin,
    );
    expect(origens.length).toBeGreaterThan(0);
    for (const origem of origens) {
      const permitido = [
        ...diretiva('style-src'),
        ...diretiva('font-src'),
      ].includes(origem);
      expect(permitido, origem).toBe(true);
      // O service worker também busca essas origens (cache das fontes).
      expect(diretiva('connect-src'), origem).toContain(origem);
    }
  });
});
