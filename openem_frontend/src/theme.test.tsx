import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { paletteFromBrand } from './lib/theme-derive';
import { fromOneSide, STORAGE_KEY as CUSTOM_KEY } from './theme-custom';
import { initialTheme, parseTheme, ThemeProvider, useTheme } from './theme';

type Ctx = ReturnType<typeof useTheme>;

function mount() {
  const ref: { current: Ctx | null } = { current: null };
  function Probe() {
    ref.current = useTheme();
    return null;
  }
  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );
  return ref as { current: Ctx };
}

const root = document.documentElement;

beforeEach(() => {
  localStorage.clear();
  root.removeAttribute('data-theme');
  root.removeAttribute('data-fx');
  root.removeAttribute('style');
});

describe('parseTheme', () => {
  it('aceita família conhecida + lado', () => {
    expect(parseTheme('cyberpunk-dark')).toEqual({ family: 'cyberpunk', variant: 'dark' });
    expect(parseTheme('oled-light')).toEqual({ family: 'oled', variant: 'light' });
    for (const lixo of ['custom', 'rosa-dark', 'default', 'default-dim', '']) {
      expect(parseTheme(lixo)).toBeNull();
    }
  });

  it('custom só vale se houver tema salvo', () => {
    expect(parseTheme('custom-dark')).toBeNull();
    expect(parseTheme('custom-dark', () => true)).toEqual({ family: 'custom', variant: 'dark' });
  });
});

describe('initialTheme', () => {
  it('migra o personalizado antigo para o formato com dois lados', () => {
    localStorage.setItem('openem.theme', 'custom');
    localStorage.setItem(CUSTOM_KEY, JSON.stringify({ bg: '#101418', brand: '#ff0066' }));
    expect(initialTheme()).toBe('custom-dark');
    expect(localStorage.getItem('openem.theme')).toBe('custom-dark');
    const salvo = JSON.parse(localStorage.getItem(CUSTOM_KEY)!);
    expect(salvo.v).toBe(2);
    expect(salvo.dark.bg).toBe('#101418');
  });

  it('valor inválido cai no padrão', () => {
    localStorage.setItem('openem.theme', 'custom');
    expect(initialTheme()).toMatch(/^default-/);
  });
});

describe('ThemeProvider', () => {
  it('troca família mantendo o lado e alterna claro/escuro', () => {
    localStorage.setItem('openem.theme', 'sepia-dark');
    const t = mount();
    expect(root.dataset.theme).toBe('sepia-dark');
    act(() => t.current.setFamily('ember'));
    expect(root.dataset.theme).toBe('ember-dark');
    act(() => t.current.toggle());
    expect(root.dataset.theme).toBe('ember-light');
    expect(localStorage.getItem('openem.theme')).toBe('ember-light');
  });

  it('personalizado alterna entre os dois lados (não volta ao padrão)', () => {
    const custom = fromOneSide(paletteFromBrand('#00707a', 'light'), 'light', 'Mar');
    const t = mount();
    act(() => t.current.applyCustom(custom, 'light'));
    expect(root.dataset.theme).toBe('custom-light');
    expect(root.style.getPropertyValue('--bg')).toBe(custom.light.bg);

    act(() => t.current.toggle());
    expect(root.dataset.theme).toBe('custom-dark');
    expect(root.style.getPropertyValue('--bg')).toBe(custom.dark.bg);
    expect(t.current.family).toBe('custom');

    // Sair do custom tira os estilos inline.
    act(() => t.current.setFamily('azure'));
    expect(root.dataset.theme).toBe('azure-dark');
    expect(root.style.getPropertyValue('--bg')).toBe('');
  });

  it('setFamily("custom") sem tema salvo não faz nada', () => {
    localStorage.setItem('openem.theme', 'default-light');
    const t = mount();
    act(() => t.current.setFamily('custom'));
    expect(root.dataset.theme).toBe('default-light');
  });

  it('liga e desliga os efeitos visuais', () => {
    const t = mount();
    expect(t.current.effects).toBe(true);
    act(() => t.current.setEffects(false));
    expect(root.dataset.fx).toBe('off');
    expect(localStorage.getItem('openem.theme.fx')).toBe('off');
    act(() => t.current.setEffects(true));
    expect(root.dataset.fx).toBeUndefined();
  });
});
