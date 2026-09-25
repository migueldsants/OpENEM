import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FAMILIES } from './theme';
import { customScheme } from './theme-custom';

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
  root.removeAttribute('data-scheme');
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

  it.each(FAMILIES.flatMap((f) => [`${f.key}-light`, `${f.key}-dark`]))(
    'aplica o tema salvo %s antes da pintura',
    (tema) => {
      expect(boot({ 'openem.theme': tema }).dataset.theme).toBe(tema);
    },
  );

  it('valor desconhecido ou antigo cai no padrão (sem data-theme órfão)', () => {
    for (const lixo of ['dark', 'light', 'rosa-dark', '']) {
      expect(boot({ 'openem.theme': lixo }).dataset.theme).toMatch(
        /^default-(light|dark)$/,
      );
    }
  });

  it('reaplica o tema personalizado com o mesmo lado claro/escuro do app', () => {
    for (const bg of ['#101418', '#fafafa', '#767676', '#3a3a3a']) {
      const custom = { bg, brand: '#ff0066', inventado: '#000' };
      const root = boot({
        'openem.theme': 'custom',
        'openem.theme.custom': JSON.stringify(custom),
      });
      expect(root.dataset.theme).toBe('custom');
      expect(root.style.getPropertyValue('--bg')).toBe(bg);
      expect(root.style.getPropertyValue('--brand')).toBe('#ff0066');
      expect(root.style.getPropertyValue('--inventado')).toBe('');
      expect(root.dataset.scheme).toBe(customScheme(custom));
    }
  });

  it('custom sem JSON salvo cai no padrão', () => {
    expect(boot({ 'openem.theme': 'custom' }).dataset.theme).toMatch(
      /^default-/,
    );
  });
});
