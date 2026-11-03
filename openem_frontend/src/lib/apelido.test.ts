import { describe, expect, it } from 'vitest';
import { erroDeFormato, normalizarApelido } from './apelido';

describe('normalizarApelido', () => {
  it('tira espaços, o @ da frente e põe em minúsculas', () => {
    expect(normalizarApelido('  @Maria.Estuda ')).toBe('maria.estuda');
  });
});

describe('erroDeFormato', () => {
  it.each(['ana', 'joao.silva', 'medicina_2027', 'a'.repeat(20)])(
    'aceita %s',
    (apelido) => {
      expect(erroDeFormato(apelido)).toBeNull();
    },
  );

  it.each([
    ['ab', /3 a 20/],
    ['a'.repeat(21), /3 a 20/],
    ['maria silva', /sem espaços/],
    ['joão', /sem acento/],
    ['.ana', /ponto/],
    ['ana.', /ponto/],
    ['an..a', /ponto/],
    ['2008', /uma letra/],
  ])('recusa %s', (apelido, mensagem) => {
    expect(erroDeFormato(apelido)).toMatch(mensagem);
  });
});
