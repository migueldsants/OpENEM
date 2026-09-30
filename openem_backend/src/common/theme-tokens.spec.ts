import {
  parseThemeTokens,
  readStoredTokens,
  THEME_TOKEN_KEYS,
} from './theme-tokens';

const valid = Object.fromEntries(
  THEME_TOKEN_KEYS.map((k, i) => [k, `#0${i}a0B0`]),
);

describe('parseThemeTokens', () => {
  it('aceita as 10 chaves em #rrggbb e normaliza para minúsculas', () => {
    const out = parseThemeTokens({ ...valid, bg: ' #FFFFFF ' });
    expect(out).not.toBeNull();
    expect(out!.bg).toBe('#ffffff');
    expect(out!.fg).toBe('#04a0b0');
    expect(Object.keys(out!)).toEqual([...THEME_TOKEN_KEYS]);
  });

  it('descarta chaves extras', () => {
    const out = parseThemeTokens({ ...valid, inventado: '#000000' });
    expect(out).not.toHaveProperty('inventado');
  });

  it.each([
    ['url()', 'url(https://evil.example/x.png)'],
    ['var()', 'var(--brand)'],
    ['nome de cor', 'red'],
    ['hex curto', '#fff'],
    ['hex com alfa', '#ffffff80'],
    ['sem #', 'ffffff'],
    ['injeção', '#ffffff; background: url(x)'],
    ['número', 123],
  ])('rejeita %s', (_nome, value) => {
    expect(parseThemeTokens({ ...valid, brand: value })).toBeNull();
  });

  it('rejeita chave faltando e entradas que não são objeto', () => {
    const semMuted: Record<string, string> = { ...valid };
    delete semMuted.muted;
    expect(parseThemeTokens(semMuted)).toBeNull();
    for (const x of [null, undefined, 'x', 42, [valid]]) {
      expect(parseThemeTokens(x)).toBeNull();
    }
  });
});

describe('readStoredTokens', () => {
  it('lê o JSON salvo e tolera lixo', () => {
    expect(readStoredTokens(JSON.stringify(valid))?.brand).toBe('#07a0b0');
    expect(readStoredTokens('{quebrado')).toBeNull();
    expect(readStoredTokens('{}')).toBeNull();
  });
});
