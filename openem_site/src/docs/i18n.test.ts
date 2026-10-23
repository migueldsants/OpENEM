import { describe, expect, it } from 'vitest';
import { baseDo, idiomaDaUrl, langDo, TEXTOS, urlNoIdioma } from './i18n';

describe('idiomaDaUrl', () => {
  it.each([
    ['/docs/', 'pt'],
    ['/docs/hospedar/ia/', 'pt'],
    ['/docs/en/', 'en'],
    ['/docs/en', 'en'],
    ['/docs/en/hospedar/ia/', 'en'],
    // Um slug que começa com "en" não é o idioma.
    ['/docs/entrar/', 'pt'],
  ])('%s → %s', (url, idioma) => {
    expect(idiomaDaUrl(url)).toBe(idioma);
  });
});

describe('urlNoIdioma', () => {
  it('troca o idioma mantendo a página', () => {
    expect(urlNoIdioma('/docs/hospedar/ia/', 'en')).toBe('/docs/en/hospedar/ia/');
    expect(urlNoIdioma('/docs/en/hospedar/ia/', 'pt')).toBe('/docs/hospedar/ia/');
  });

  it('o início vai para o início', () => {
    expect(urlNoIdioma('/docs/', 'en')).toBe('/docs/en/');
    expect(urlNoIdioma('/docs/en/', 'pt')).toBe('/docs/');
  });

  it('no mesmo idioma, nada muda', () => {
    expect(urlNoIdioma('/docs/en/contribuir/temas/', 'en')).toBe('/docs/en/contribuir/temas/');
  });
});

describe('idiomas', () => {
  it('base e lang', () => {
    expect(baseDo('pt')).toBe('/docs/');
    expect(baseDo('en')).toBe('/docs/en/');
    expect(langDo('pt')).toBe('pt-BR');
    expect(langDo('en')).toBe('en');
  });

  it('os dois idiomas têm os mesmos textos', () => {
    expect(Object.keys(TEXTOS.en).sort()).toEqual(Object.keys(TEXTOS.pt).sort());
  });

  it('os textos da interface não têm travessão', () => {
    for (const idioma of ['pt', 'en'] as const) {
      for (const v of Object.values(TEXTOS[idioma])) {
        const texto = typeof v === 'function' ? v('x') : v;
        expect(texto).not.toMatch(/[—–]/);
      }
    }
  });
});
