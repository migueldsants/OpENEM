import { allocateByWeight, sampleOffsets, Stratum } from './sampling';

/** RNG determinístico: repete a sequência dada, para o teste não depender de sorte. */
function rngFrom(valores: number[]): () => number {
  let i = 0;
  return () => valores[i++ % valores.length];
}

function totalDe(vagas: Map<string | null, number>): number {
  return [...vagas.values()].reduce((a, b) => a + b, 0);
}

describe('allocateByWeight', () => {
  const estratos: Stratum[] = [
    { key: 't1', available: 10, weight: 1 },
    { key: 't2', available: 10, weight: 1 },
  ];

  it('distribui exatamente o total pedido', () => {
    const vagas = allocateByWeight(estratos, 6, rngFrom([0.1, 0.9]));
    expect(totalDe(vagas)).toBe(6);
  });

  it('nunca ultrapassa o disponível de um estrato', () => {
    const vagas = allocateByWeight(
      [
        { key: 't1', available: 2, weight: 5 },
        { key: 't2', available: 50, weight: 1 },
      ],
      10,
      rngFrom([0]), // sempre o primeiro estrato elegível
    );
    expect(vagas.get('t1')).toBeLessThanOrEqual(2);
    expect(totalDe(vagas)).toBe(10);
  });

  it('limita ao total disponível quando se pede mais do que existe', () => {
    const vagas = allocateByWeight(
      [{ key: 't1', available: 3, weight: 1 }],
      90,
      rngFrom([0.5]),
    );
    expect(totalDe(vagas)).toBe(3);
  });

  it('o peso maior recebe mais vagas do que o menor', () => {
    // Estratos do mesmo tamanho: a diferença vem só do peso.
    const vagas = allocateByWeight(
      [
        { key: 'leve', available: 100, weight: 1 },
        { key: 'pesado', available: 100, weight: 9 },
      ],
      50,
      rngFrom([0.05, 0.35, 0.65, 0.95]),
    );
    expect(vagas.get('pesado')!).toBeGreaterThan(vagas.get('leve') ?? 0);
  });

  it('o estrato sem assunto (key null) participa do sorteio', () => {
    const vagas = allocateByWeight(
      [{ key: null, available: 20, weight: 3 }],
      5,
      rngFrom([0.5]),
    );
    // É o caso do banco oficial do ENEM antes da classificação: se ficasse de
    // fora, o simulado não teria de onde sortear.
    expect(vagas.get(null)).toBe(5);
  });

  it('ignora estratos vazios ou de peso zero', () => {
    const vagas = allocateByWeight(
      [
        { key: 'vazio', available: 0, weight: 5 },
        { key: 'sem-peso', available: 10, weight: 0 },
        { key: 'valido', available: 10, weight: 1 },
      ],
      4,
      rngFrom([0.5]),
    );
    expect(vagas.get('vazio')).toBeUndefined();
    expect(vagas.get('sem-peso')).toBeUndefined();
    expect(vagas.get('valido')).toBe(4);
  });

  it('total <= 0 não distribui nada', () => {
    expect(totalDe(allocateByWeight(estratos, 0, rngFrom([0.5])))).toBe(0);
    expect(totalDe(allocateByWeight(estratos, -3, rngFrom([0.5])))).toBe(0);
  });
});

describe('sampleOffsets', () => {
  it('devolve posições distintas, dentro do conjunto e em ordem', () => {
    const out = sampleOffsets(100, 10);
    expect(out).toHaveLength(10);
    expect(new Set(out).size).toBe(10);
    expect(out.every((p) => p >= 0 && p < 100)).toBe(true);
    expect([...out].sort((a, b) => a - b)).toEqual(out);
  });

  it('com colisões do RNG, ainda devolve posições distintas', () => {
    // RNG sempre 0: Floyd resolve a colisão usando o índice corrente.
    const out = sampleOffsets(10, 4, () => 0);
    expect(new Set(out).size).toBe(4);
  });

  it('NÃO devolve uma janela contígua', () => {
    // O defeito que motivou a troca: ids importados em sequência fariam uma
    // janela contígua sair inteira da mesma prova.
    const out = sampleOffsets(4000, 45, rngFrom([0.9, 0.1, 0.5, 0.3, 0.7]));
    const contigua = out.every((p, i) => i === 0 || p === out[i - 1] + 1);
    expect(contigua).toBe(false);
    expect(out[out.length - 1] - out[0]).toBeGreaterThan(45);
  });

  it('limita ao total quando se pede mais do que existe', () => {
    expect(sampleOffsets(3, 10)).toEqual([0, 1, 2]);
  });

  it('total ou take zero não sorteiam nada', () => {
    expect(sampleOffsets(0, 5)).toEqual([]);
    expect(sampleOffsets(5, 0)).toEqual([]);
  });
});
