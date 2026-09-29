import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FAMILIES } from './theme';
import { paletteFromBrand } from './lib/theme-derive';
import { customScheme, fromOneSide } from './theme-custom';

/**
 * O script inline do index.html roda antes do React para não piscar o tema
 * errado. Ele não pode importar nada, então repete a lista de famílias e a
 * conta de luminância: estes testes seguram os dois lados juntos.
 */
const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
const script = /<script id="theme-boot">([\s\S]*?)<\/script>/.exec(html)?.[1];

function boot(saved: Record<string, string>) {
  localStorage.clear();
  for (const [k, v] of Object.entries(saved)) localStorage.setItem(k, v);
  const root = document.documentElement;
  root.removeAttribute('data-theme');
  root.removeAttribute('data-fx');
  root.removeAttribute('style');
  new Function(script!)();
  return root;
}

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('style');
});

describe('script de tema do index.html', () => {
  it('existe', () => {
    expect(script).toBeTruthy();
  });

  it('conhece exatamente as mesmas famílias que FAMILIES', () => {
    const lista = /var families = \[([\s\S]*?)\];/.exec(script!)?.[1] ?? '';
    const chaves = [...lista.matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
    expect(chaves.sort()).toEqual(FAMILIES.map((f) => f.key).sort());
  });

  it.each(FAMILIES.flatMap((f) => [`${f.key}-light`, `${f.key}-dark`]))(
    'aplica o tema salvo %s antes da pintura',
    (tema) => {
      expect(boot({ 'openem.theme': tema }).dataset.theme).toBe(tema);
    },
  );

  it('valor desconhecido ou antigo cai no padrão (sem data-theme órfão)', () => {
    for (const lixo of ['dark', 'light', 'rosa-dark', '', 'default-dim']) {
      expect(boot({ 'openem.theme': lixo }).dataset.theme).toMatch(
        /^default-(light|dark)$/,
      );
    }
  });

  it('aplica o lado pedido do tema personalizado', () => {
    const custom = fromOneSide(paletteFromBrand('#ff0066', 'light'), 'light');
    for (const side of ['light', 'dark'] as const) {
      const root = boot({
        'openem.theme': `custom-${side}`,
        'openem.theme.custom': JSON.stringify(custom),
      });
      expect(root.dataset.theme).toBe(`custom-${side}`);
      expect(root.style.getPropertyValue('--bg')).toBe(custom[side].bg);
      expect(root.style.getPropertyValue('--brand')).toBe(custom[side].brand);
    }
  });

  it('não aplica valor que não seja #rrggbb', () => {
    const root = boot({
      'openem.theme': 'custom-dark',
      'openem.theme.custom': JSON.stringify({
        v: 2,
        name: 'x',
        light: {},
        dark: { bg: 'url(https://evil.example/x.png)', brand: '#FF0066' },
      }),
    });
    expect(root.dataset.theme).toBe('custom-dark');
    expect(root.style.getPropertyValue('--bg')).toBe('');
    expect(root.style.getPropertyValue('--brand')).toBe('#ff0066');
  });

  it('reaplica o tema personalizado antigo (um lado só) no lado certo', () => {
    for (const bg of ['#101418', '#fafafa', '#767676', '#3a3a3a']) {
      const custom = { bg, brand: '#ff0066', inventado: '#000000' };
      const root = boot({
        'openem.theme': 'custom',
        'openem.theme.custom': JSON.stringify(custom),
      });
      expect(root.dataset.theme).toBe(`custom-${customScheme(custom)}`);
      expect(root.style.getPropertyValue('--bg')).toBe(bg);
      expect(root.style.getPropertyValue('--brand')).toBe('#ff0066');
      expect(root.style.getPropertyValue('--inventado')).toBe('');
    }
  });

  it('custom sem JSON salvo cai no padrão', () => {
    for (const t of ['custom', 'custom-dark']) {
      expect(boot({ 'openem.theme': t }).dataset.theme).toMatch(/^default-/);
    }
  });

  it('desliga os efeitos visuais antes da pintura', () => {
    expect(boot({ 'openem.theme.fx': 'off' }).dataset.fx).toBe('off');
    expect(boot({ 'openem.theme.fx': 'on' }).dataset.fx).toBeUndefined();
  });
});
