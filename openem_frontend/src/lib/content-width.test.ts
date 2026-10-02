import { describe, expect, it } from 'vitest';
import { CONTENT_MAX_W, contentWidth } from './content-width';

describe('contentWidth', () => {
  it('cronograma usa a grade larga', () => {
    expect(contentWidth('/cronograma')).toBe('grade');
  });

  it('telas de cartões e gráficos usam a largura de painel', () => {
    for (const p of ['/', '/painel', '/desempenho', '/progresso', '/conquistas']) {
      expect(contentWidth(p)).toBe('painel');
    }
  });

  it('o resto fica na coluna de leitura, inclusive subrotas', () => {
    for (const p of ['/questoes', '/ferramentas', '/revisao', '/perfil', '/painel/x']) {
      expect(contentWidth(p)).toBe('leitura');
    }
  });

  it('leitura e painel são iguais até o xl; só o painel cresce no monitor largo', () => {
    expect(CONTENT_MAX_W.leitura.split(' ')[0]).toBe('max-w-3xl');
    expect(CONTENT_MAX_W.painel.split(' ')[0]).toBe('max-w-3xl');
    expect(CONTENT_MAX_W.painel).toContain('2xl:max-w-7xl');
    expect(CONTENT_MAX_W.leitura).toContain('2xl:max-w-5xl');
  });

  it('a grade do cronograma mantém os 1700px de antes', () => {
    expect(CONTENT_MAX_W.grade).toBe('max-w-[1700px]');
  });
});
