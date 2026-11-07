import { NotFoundException } from '@nestjs/common';
import { TracksService } from './tracks.service';

/** Cache que só repassa: o serviço é testado sem Redis. */
const cache = {
  getOrSet: jest.fn((_k: unknown, _t: unknown, loader: () => unknown) =>
    loader(),
  ),
};

function makePrisma(foreignLanguage = 'ingles') {
  return {
    examYear: {
      findMany: jest.fn().mockResolvedValue([{ id: 'e2025', year: 2025 }]),
    },
    question: {
      groupBy: jest.fn(({ by }: { by: string[] }) =>
        Promise.resolve(
          by.length === 1
            ? [{ topicId: 'razao', _count: { _all: 40 } }]
            : [
                {
                  topicId: 'razao',
                  examYearId: 'e2025',
                  language: null,
                  _count: { _all: 5 },
                },
              ],
        ),
      ),
    },
    subject: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 's-mat',
          name: 'Matemática',
          subjectArea: { id: 'a-mat', name: 'Matemática e suas Tecnologias' },
          topics: [{ id: 'razao', name: 'Razão e proporção' }],
        },
      ]),
    },
    answer: {
      findMany: jest.fn().mockResolvedValue([
        { isCorrect: true, question: { topicId: 'razao' } },
        { isCorrect: false, question: { topicId: 'razao' } },
        { isCorrect: true, question: { topicId: 'razao' } },
      ]),
    },
    profile: {
      findUnique: jest.fn().mockResolvedValue({ foreignLanguage }),
    },
  };
}

describe('TracksService', () => {
  it('a visão geral junta a incidência do catálogo e o domínio do aluno', async () => {
    const prisma = makePrisma();
    const service = new TracksService(prisma as any, cache as any);

    const res = await service.overview('u1');

    expect(res.window).toMatchObject({
      fromYear: 2025,
      toYear: 2025,
      exams: 1,
    });
    expect(res.subjects).toHaveLength(1);
    expect(res.subjects[0]).toMatchObject({
      id: 's-mat',
      perExam: 5,
      mastery: 67,
      answered: 3,
    });
    expect(res.overall).toMatchObject({ answered: 3, enough: false });
    expect(res.suggestions[0]).toMatchObject({ subjectId: 's-mat' });
    // O catálogo vai para o cache compartilhado; as respostas, não.
    expect(cache.getOrSet).toHaveBeenCalledWith(
      ['tracks'],
      expect.any(Number),
      expect.any(Function),
      { ns: 'catalog' },
    );
    expect(prisma.answer.findMany.mock.calls[0][0].where.userId).toBe('u1');
  });

  it('a trilha de uma matéria traz etapas e assuntos com estado', async () => {
    const service = new TracksService(makePrisma() as any, cache as any);
    const res = await service.detail('u1', 's-mat');
    expect(res.subject.name).toBe('Matemática');
    const razao = res.stages
      .flatMap((s) => s.topics)
      .find((t) => t.id === 'razao');
    expect(razao).toMatchObject({ state: 'praticando', bank: 40, perExam: 5 });
    expect(res.language).toBe('ingles');
  });

  it('matéria sem trilha é 404', async () => {
    const service = new TracksService(makePrisma() as any, cache as any);
    await expect(service.detail('u1', 'nao-existe')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('a língua vem do perfil', async () => {
    const service = new TracksService(
      makePrisma('espanhol') as any,
      cache as any,
    );
    expect((await service.overview('u1')).language).toBe('espanhol');
  });
});
