import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from './lib/color';
import { FAMILIES } from './theme';

/**
 * Auditoria de contraste das paletas prontas. Os valores vivem no CSS (o
 * script de boot precisa deles antes do JS), então o teste lê os arquivos e
 * confere cada lado de cada família. Tema novo que deixa texto ilegível
 * quebra aqui, não na mão do aluno.
 */
const css = ['./index.css', './themes.css']
  .map((f) => {
    try {
      return readFileSync(resolve(__dirname, f), 'utf8');
    } catch {
      return '';
    }
  })
  .join('\n')
  // Comentários ficariam grudados no seletor do bloco seguinte.
  .replace(/\/\*[\s\S]*?\*\//g, '');

type Tokens = Record<string, string>;

/** Junta as declarações `--x: #hex` de todo bloco cujo seletor bate. */
function tokensFor(match: (selector: string) => boolean): Tokens {
  const out: Tokens = {};
  const block = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = block.exec(css))) {
    const selectors = m[1].split(',').map((s) => s.trim());
    if (!selectors.some(match)) continue;
    const decl = /--([\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g;
    let d: RegExpExecArray | null;
    while ((d = decl.exec(m[2]))) out[d[1]] = d[2].toLowerCase();
  }
  return out;
}

const AREAS = ['mat', 'nat', 'hum', 'lin', 'red', 'danger'];
const areaTokens = {
  light: tokensFor((s) => s === ':root'),
  dark: tokensFor((s) => s === "[data-theme$='-dark']"),
};

const cases = FAMILIES.flatMap((f) =>
  (['light', 'dark'] as const).map((variant) => ({
    id: `${f.key}-${variant}`,
    variant,
  })),
);

describe.each(cases)('paleta $id', ({ id, variant }) => {
  const t = tokensFor((s) => s === `[data-theme='${id}']`);
  const surfaces = ['bg', 'surface', 'surface-2'];
  const ratio = (fg: string, bg: string) => contrastRatio(t[fg], t[bg]);

  it('define todos os tokens de cor', () => {
    for (const k of [
      'bg',
      'sidebar',
      'surface',
      'surface-2',
      'fg',
      'muted',
      'line',
      'brand',
      'brand-2',
      'brand-ink',
    ]) {
      expect(t[k], k).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('texto principal >= 7:1 (AAA) sobre fundo e cartões', () => {
    for (const bg of [...surfaces, 'sidebar']) {
      expect(ratio('fg', bg), `fg/${bg}`).toBeGreaterThanOrEqual(7);
    }
  });

  it('texto suave >= 4.5:1 (AA) sobre fundo e cartões', () => {
    for (const bg of [...surfaces, 'sidebar']) {
      expect(ratio('muted', bg), `muted/${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('texto sobre a marca >= 4.5:1 e marca >= 3:1 sobre cartões', () => {
    expect(ratio('brand-ink', 'brand')).toBeGreaterThanOrEqual(4.5);
    for (const bg of surfaces) {
      expect(ratio('brand', bg), `brand/${bg}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('cores das áreas >= 4.5:1 sobre fundo e cartões', () => {
    const areas = areaTokens[variant];
    for (const a of AREAS) {
      for (const bg of surfaces) {
        expect(
          contrastRatio(areas[a], t[bg]),
          `${a}/${bg}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
