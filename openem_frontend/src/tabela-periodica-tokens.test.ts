import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio, parseHex, toHex } from './lib/color';
import { CATEGORIAS } from './lib/elementos';
import { PASSOS_ESCALA } from './lib/propriedades-periodicas';
import { FAMILIES } from './theme';

/**
 * Contraste da tabela periódica em todos os temas. A casa é a folha do tema
 * (`--surface`) tingida com o tom da categoria (`--tp-mix`) ou do mapa de
 * calor (`--tp-calor-N`), via `color-mix(in srgb, …)`. Todo texto da casa é
 * `--fg`: o `--muted` já fica no limite de 4,5:1 sobre a folha em vários
 * temas, e qualquer tingimento o derrubaria. A hierarquia (número, símbolo,
 * nome, massa) vem do tamanho e do peso.
 */
const css = ['./index.css', './themes.css']
  .map((f) => readFileSync(resolve(__dirname, f), 'utf8'))
  .join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '');

function declaracoes(match: (selector: string) => boolean): Record<string, string> {
  const out: Record<string, string> = {};
  const bloco = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = bloco.exec(css))) {
    if (!m[1].split(',').map((s) => s.trim()).some(match)) continue;
    const decl = /--([\w-]+)\s*:\s*([^;]+);/g;
    let d: RegExpExecArray | null;
    while ((d = decl.exec(m[2]))) out[d[1]] = d[2].trim().toLowerCase();
  }
  return out;
}

const lado = {
  light: declaracoes((s) => s === ':root' || s === "[data-theme$='-light']"),
  dark: declaracoes((s) => s === "[data-theme$='-dark']"),
};

/** `color-mix(in srgb, cor p%, fundo)`: interpolação nos componentes sRGB. */
function misturar(cor: string, p: number, fundo: string): string {
  const a = parseHex(cor)!;
  const b = parseHex(fundo)!;
  return toHex([0, 1, 2].map((i) => a[i] * p + b[i] * (1 - p)) as [number, number, number]);
}

const pct = (v: string) => Number(v.replace('%', '')) / 100;

const casos = FAMILIES.flatMap((f) =>
  (['light', 'dark'] as const).map((variante) => ({ id: `${f.key}-${variante}`, variante })),
);

describe('tokens da tabela periódica', () => {
  it('define um tom por categoria e os degraus do mapa de calor nos dois lados', () => {
    for (const v of ['light', 'dark'] as const) {
      for (const c of CATEGORIAS) expect(lado[v][`tp-${c.key}`], `${v} ${c.key}`).toMatch(/^#[0-9a-f]{6}$/);
      expect(lado[v]['tp-calor']).toMatch(/^#[0-9a-f]{6}$/);
      expect(lado[v]['tp-mix']).toMatch(/^\d+%$/);
      for (let i = 0; i < PASSOS_ESCALA; i++) expect(lado[v][`tp-calor-${i}`], `${v} passo ${i}`).toMatch(/^\d+%$/);
    }
  });

  it('os degraus do mapa de calor só escurecem/clareiam (sequenciais)', () => {
    for (const v of ['light', 'dark'] as const) {
      const passos = Array.from({ length: PASSOS_ESCALA }, (_, i) => pct(lado[v][`tp-calor-${i}`]));
      expect([...passos].sort((a, b) => a - b)).toEqual(passos);
      expect(new Set(passos).size).toBe(PASSOS_ESCALA);
    }
  });
});

describe.each(casos)('tabela periódica no tema $id', ({ id, variante }) => {
  const t = declaracoes((s) => s === `[data-theme='${id}']`);
  const tokens = lado[variante];
  const fundos = [
    ...CATEGORIAS.map((c) => ({ nome: c.key, cor: misturar(tokens[`tp-${c.key}`], pct(tokens['tp-mix']), t.surface) })),
    ...Array.from({ length: PASSOS_ESCALA }, (_, i) => ({
      nome: `calor-${i}`,
      cor: misturar(tokens['tp-calor'], pct(tokens[`tp-calor-${i}`]), t.surface),
    })),
  ];

  it('texto da casa ≥ 4,5:1 sobre todo fundo tingido', () => {
    for (const f of fundos) {
      expect(contrastRatio(t.fg, f.cor), `fg/${f.nome}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
