import { describe, expect, it } from 'vitest';
import { vaos } from './grade';

/** Simula o preenchimento da grade: nenhum cartão pode quebrar uma fileira. */
function fileiras(v: number[], colunas: number) {
  const linhas: number[] = [];
  let atual = 0;
  for (const s of v) {
    if (atual + s > colunas) {
      linhas.push(atual);
      atual = 0;
    }
    atual += s;
  }
  linhas.push(atual);
  return linhas;
}

describe('vaos (cartões que ocupam mais colunas)', () => {
  it('toda fileira fecha exatamente, sem buraco', () => {
    for (const colunas of [2, 3]) {
      for (let n = 1; n <= 25; n++) {
        const v = vaos(n, colunas);
        expect(v).toHaveLength(n);
        expect(fileiras(v, colunas).every((l) => l === colunas), `${n}/${colunas}`).toBe(true);
      }
    }
  });

  it('a fileira incompleta vai na frente e ocupa a largura toda', () => {
    expect(vaos(11, 3)).toEqual([2, 1, ...Array(9).fill(1)]);
    expect(vaos(7, 3)).toEqual([3, ...Array(6).fill(1)]);
    expect(vaos(1, 3)).toEqual([3]);
    expect(vaos(2, 3)).toEqual([2, 1]);
    expect(vaos(6, 3)).toEqual(Array(6).fill(1));
    expect(vaos(7, 2)).toEqual([2, 1, 1, 1, 1, 1, 1]);
  });
});
