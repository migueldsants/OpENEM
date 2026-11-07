import { recomputeTopicWeights } from './topic-weights';

function makeDb(exams: number) {
  const ids = Array.from({ length: exams }, (_, i) => ({
    id: `e${2016 + i}`,
    year: 2016 + i,
  }));
  return {
    examYear: { findMany: jest.fn().mockResolvedValue(ids) },
    question: {
      groupBy: jest.fn(({ by }: { by: string[] }) =>
        Promise.resolve(
          by.length === 1
            ? []
            : // "muito" cai 4 por prova, "pouco" 1 vez na janela toda.
              [
                ...ids.map((e) => ({
                  topicId: 'muito',
                  examYearId: e.id,
                  language: null,
                  _count: { _all: 4 },
                })),
                {
                  topicId: 'pouco',
                  examYearId: ids[0]?.id,
                  language: null,
                  _count: { _all: 1 },
                },
              ],
        ),
      ),
    },
    topic: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'muito', weight: 3 },
        { id: 'pouco', weight: 1 },
        { id: 'nunca', weight: 4 },
      ]),
      updateMany: jest.fn(({ where }: { where: { id: { in: string[] } } }) =>
        Promise.resolve({ count: where.id.in.length }),
      ),
    },
  };
}

describe('recomputeTopicWeights', () => {
  const quieto = () => {};

  it('com poucas provas regulares mantém o peso curado', async () => {
    const db = makeDb(2);
    await expect(recomputeTopicWeights(db as any, quieto)).resolves.toBeNull();
    expect(db.topic.updateMany).not.toHaveBeenCalled();
  });

  it('grava só o que mudou, um updateMany por peso', async () => {
    const db = makeDb(10);
    await expect(recomputeTopicWeights(db as any, quieto)).resolves.toBe(2);
    const chamadas = db.topic.updateMany.mock.calls.map(([a]) => [
      a.data.weight,
      a.where.id.in,
    ]);
    expect(chamadas).toEqual(
      expect.arrayContaining([
        [5, ['muito']],
        [1, ['nunca']],
      ]),
    );
    // "pouco" (0,1 por prova) já tinha peso 1: não é regravado.
    expect(chamadas).toHaveLength(2);
  });

  it('deixa a Redação de fora (não tem questão objetiva)', async () => {
    const db = makeDb(10);
    await recomputeTopicWeights(db as any, quieto);
    expect(db.topic.findMany.mock.calls[0][0].where).toEqual({
      subject: { name: { notIn: ['Redação'] } },
    });
  });
});
