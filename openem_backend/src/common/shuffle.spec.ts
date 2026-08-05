import { shuffle } from './shuffle';

describe('shuffle (Fisher-Yates)', () => {
  it('preserva os mesmos elementos (multiset)', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffle(input);
    expect(out.sort()).toEqual(input.sort());
  });

  it('nao muta a lista original', () => {
    const input = [1, 2, 3, 4];
    const copy = [...input];
    shuffle(input);
    expect(input).toEqual(copy);
  });

  it('retorna lista vazia para entrada vazia', () => {
    expect(shuffle([])).toEqual([]);
  });

  it('preserva elemento unico', () => {
    expect(shuffle(['x'])).toEqual(['x']);
  });

  it('distribui de forma razoavelmente aleatoria (nao sempre identica)', () => {
    const input = Array.from({ length: 20 }, (_, i) => i);
    let shuffledAtLeastOnce = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      if (shuffle(input).some((v, i) => v !== input[i])) {
        shuffledAtLeastOnce = true;
        break;
      }
    }
    expect(shuffledAtLeastOnce).toBe(true);
  });
});