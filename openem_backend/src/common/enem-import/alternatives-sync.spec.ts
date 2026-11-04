import { AlternativeData, planAlternativesSync } from './alternatives-sync';

const alt = (
  letter: string,
  text: string,
  position: number,
  extra: Partial<AlternativeData> = {},
): AlternativeData => ({
  letter,
  text,
  imageUrl: null,
  isCorrect: false,
  position,
  ...extra,
});

const comId = (a: AlternativeData) => ({ ...a, id: `id-${a.letter}` });

describe('planAlternativesSync', () => {
  const antigas = [
    alt('A', '1,0 × 104 ton', 0),
    alt('B', '3,9 × 105 ton', 1),
    alt('C', '5,0 × 105 ton', 2, { isCorrect: true }),
  ];

  it('nada mudou: não mexe', () => {
    expect(planAlternativesSync(antigas.map(comId), antigas)).toEqual({
      kind: 'unchanged',
    });
  });

  it('texto limpo de outro jeito: atualiza no lugar e mantém o id', () => {
    // Recriar orfanaria as respostas (Answer.chosenId não tem FK).
    const novas = [
      alt('A', '1,0 × 10⁴ ton', 0),
      alt('B', '3,9 × 10⁵ ton', 1),
      alt('C', '5,0 × 105 ton', 2, { isCorrect: true }),
    ];
    expect(planAlternativesSync(antigas.map(comId), novas)).toEqual({
      kind: 'update',
      updates: [
        {
          id: 'id-A',
          data: {
            letter: 'A',
            text: '1,0 × 10⁴ ton',
            imageUrl: null,
            isCorrect: false,
          },
        },
        {
          id: 'id-B',
          data: {
            letter: 'B',
            text: '3,9 × 10⁵ ton',
            imageUrl: null,
            isCorrect: false,
          },
        },
      ],
    });
  });

  it('gabarito corrigido também é atualização no lugar', () => {
    const novas = [
      alt('A', '1,0 × 104 ton', 0, { isCorrect: true }),
      alt('B', '3,9 × 105 ton', 1),
      alt('C', '5,0 × 105 ton', 2),
    ];
    const plano = planAlternativesSync(antigas.map(comId), novas);
    expect(plano.kind).toBe('update');
    if (plano.kind === 'update') {
      expect(plano.updates.map((u) => [u.id, u.data.isCorrect])).toEqual([
        ['id-A', true],
        ['id-C', false],
      ]);
    }
  });

  it('a ordem em que chegam não importa, vale a posição', () => {
    expect(
      planAlternativesSync(antigas.map(comId), [...antigas].reverse()),
    ).toEqual({ kind: 'unchanged' });
  });

  it('alternativa a mais ou a menos recria', () => {
    expect(
      planAlternativesSync(antigas.map(comId), [
        ...antigas,
        alt('D', 'nova', 3),
      ]).kind,
    ).toBe('rebuild');
    expect(
      planAlternativesSync(antigas.map(comId), antigas.slice(0, 2)).kind,
    ).toBe('rebuild');
  });

  it('letra em outra posição recria', () => {
    const trocadas = [
      alt('B', '1,0 × 104 ton', 0),
      alt('A', '3,9 × 105 ton', 1),
      alt('C', '5,0 × 105 ton', 2, { isCorrect: true }),
    ];
    expect(planAlternativesSync(antigas.map(comId), trocadas).kind).toBe(
      'rebuild',
    );
  });
});
