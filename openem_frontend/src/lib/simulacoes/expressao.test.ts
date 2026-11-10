import { describe, expect, it } from 'vitest';
import { interpretar, limparZero, tentarInterpretar, zeros } from './expressao';

const v = (texto: string, x: number, p = {}) => interpretar(texto).f(x, p);

describe('interpretador de expressões', () => {
  it('contas básicas, precedência e sinal', () => {
    expect(v('2*x + 1', 3)).toBe(7);
    expect(v('x^2 - 4', 3)).toBe(5);
    expect(v('-x^2', 3)).toBe(-9); // o menos vale depois da potência
    expect(v('2^-1', 0)).toBe(0.5);
    expect(v('2^3^2', 0)).toBe(512); // potência associa à direita
    expect(v('(x + 1)/(x - 1)', 3)).toBe(2);
    expect(v('10 - 4 - 3', 0)).toBe(3);
    expect(v('12 / 3 / 2', 0)).toBe(2);
  });

  it('multiplicação implícita e vírgula decimal', () => {
    expect(v('2x', 3)).toBe(6);
    expect(v('2,5x', 2)).toBe(5);
    expect(v('(x+1)(x-1)', 2)).toBe(3);
    expect(v('3sen(x)', Math.PI / 2)).toBeCloseTo(3, 12);
    expect(v('2x²', 3)).toBe(18);
    expect(v('x(x − 2)', 4)).toBe(8);
    expect(v('2π', 0)).toBeCloseTo(2 * Math.PI, 12);
  });

  it('funções em português e inglês, com e sem parênteses', () => {
    expect(v('sen(pi/2)', 0)).toBeCloseTo(1, 12);
    expect(v('sin(pi/2)', 0)).toBeCloseTo(1, 12);
    expect(v('tg(pi/4)', 0)).toBeCloseTo(1, 12);
    expect(v('raiz(x)', 9)).toBe(3);
    expect(v('log(100)', 0)).toBeCloseTo(2, 12);
    expect(v('log(8; 2)', 0)).toBeCloseTo(3, 12);
    expect(v('ln(e)', 0)).toBeCloseTo(1, 12);
    expect(v('exp(0)', 0)).toBe(1);
    expect(v('sen x', Math.PI / 6)).toBeCloseTo(0.5, 12);
    expect(v('xsen(x)', Math.PI / 2)).toBeCloseTo(Math.PI / 2, 12);
  });

  it('módulo com barras', () => {
    expect(v('|x - 3|', 1)).toBe(2);
    expect(v('|x| - 2', -5)).toBe(3);
    expect(v('2|x|', -1)).toBe(2);
  });

  it('parâmetros viram controles', () => {
    const f = interpretar('a x^2 + b x + c');
    expect(f.parametros).toEqual(['a', 'b', 'c']);
    expect(f.f(2, { a: 1, b: -3, c: 2 })).toBe(0);
    expect(f.f(2)).toBe(4 + 2 + 1); // sem valor, cada parâmetro vale 1
    expect(interpretar('k*2^x').parametros).toEqual(['k']);
  });

  it('raiz cúbica de negativo e domínio', () => {
    expect(v('x^(1/3)', -8)).toBeCloseTo(-2, 12);
    expect(Number.isNaN(v('raiz(x)', -1))).toBe(true);
    expect(Number.isNaN(v('ln(x)', -1))).toBe(true);
  });

  it('erros com mensagem em português e posição', () => {
    const casos: [string, RegExp][] = [
      ['x^', /expoente/],
      ['(x + 1', /fechar um parêntese/],
      ['x + 1)', /fechando sem ter aberto/],
      ['y + 1', /letra "y"/],
      ['2 # 3', /símbolo "#"/],
      ['', /Digite/],
      ['|x', /módulo/],
      ['x +', /terminou no meio/],
    ];
    for (const [texto, msg] of casos) {
      const r = tentarInterpretar(texto);
      expect(r.ok, texto).toBe(false);
      if (!r.ok) expect(r.erro, texto).toMatch(msg);
    }
    const r = tentarInterpretar('x + y');
    expect(!r.ok && r.posicao).toBe(4);
  });

  it('zeros: troca de sinal, toque e assíntota', () => {
    expect(zeros((x) => x * x - 4, -10, 10).map(limparZero)).toEqual([-2, 2]);
    expect(zeros((x) => (x - 1) ** 2, -10, 10).length).toBe(1); // toca em 1 sem trocar de sinal
    expect(zeros((x) => 1 / x, -10, 10)).toEqual([]); // troca de sinal em 0, mas é assíntota
    const z = zeros((x) => Math.sin(x), -7, 7).map(limparZero);
    expect(z.length).toBe(5);
    expect(z[2]).toBeCloseTo(0, 9);
  });
});
