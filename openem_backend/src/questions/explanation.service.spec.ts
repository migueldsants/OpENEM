import { memoryCache } from '../cache/testing';
import { questionCacheKey } from './questions.service';
import { NotFoundException } from '@nestjs/common';
import { ExplanationService } from './explanation.service';

jest.mock('../common/ai', () => ({
  isAiConfigured: jest.fn(),
  activeAiProvider: jest.fn(() => 'anthropic'),
}));
jest.mock('../common/ai/explanation', () => ({
  generateExplanation: jest.fn(),
}));

import { isAiConfigured } from '../common/ai';
import { generateExplanation } from '../common/ai/explanation';

const mockIsConfigured = isAiConfigured as jest.Mock;
const mockGenerate = generateExplanation as jest.Mock;

/** Cota da IA: por padrão deixa passar; o teste de limite troca por uma recusa. */
const quota = { reserve: jest.fn().mockResolvedValue(undefined) } as any;

function makePrisma() {
  return {
    question: {
      findUnique: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
}

const SEM_COMENTARIO = {
  id: 'q1',
  statement: 'Enunciado',
  questionPrompt: 'Comando?',
  explanation: null,
  explanationSource: null,
  subjectArea: { name: 'Matemática e suas Tecnologias' },
  topic: null,
  examYear: { label: 'ENEM 2023' },
  alternatives: [
    { letter: 'A', text: 'a', imageUrl: null, isCorrect: false },
    { letter: 'B', text: 'b', imageUrl: null, isCorrect: true },
  ],
};

describe('ExplanationService', () => {
  beforeEach(() => {
    mockIsConfigured.mockReset();
    mockGenerate.mockReset();
    quota.reserve.mockReset().mockResolvedValue(undefined);
  });

  it('404 para questão inexistente', async () => {
    const prisma = makePrisma() as any;
    prisma.question.findUnique.mockResolvedValue(null);
    await expect(
      new ExplanationService(prisma, quota, memoryCache()).explain(
        'u1',
        'nao-existe',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('recusa pela cota do aluno antes de chamar a IA', async () => {
    mockIsConfigured.mockReturnValue(true);
    const prisma = makePrisma() as any;
    prisma.question.findUnique.mockResolvedValue(SEM_COMENTARIO);
    quota.reserve.mockRejectedValueOnce(new Error('cota'));
    await expect(
      new ExplanationService(prisma, quota, memoryCache()).explain('u1', 'q1'),
    ).rejects.toThrow('cota');
    expect(quota.reserve).toHaveBeenCalledWith('u1', 'explanation');
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('comentário já gravado não consome cota', async () => {
    const prisma = makePrisma() as any;
    prisma.question.findUnique.mockResolvedValue({
      ...SEM_COMENTARIO,
      explanation: 'Pronto.',
      explanationSource: 'seed',
    });
    await new ExplanationService(prisma, quota, memoryCache()).explain(
      'u1',
      'q1',
    );
    expect(quota.reserve).not.toHaveBeenCalled();
  });

  it('devolve o comentário existente sem chamar a IA', async () => {
    const prisma = makePrisma() as any;
    prisma.question.findUnique.mockResolvedValue({
      ...SEM_COMENTARIO,
      explanation: 'Já comentada.',
      explanationSource: 'humano',
    });

    const res = await new ExplanationService(
      prisma,
      quota,
      memoryCache(),
    ).explain('u1', 'q1');

    expect(res).toEqual({
      explanation: 'Já comentada.',
      source: 'humano',
      available: true,
    });
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('sem provedor, responde available=false em vez de erro', async () => {
    const prisma = makePrisma() as any;
    prisma.question.findUnique.mockResolvedValue(SEM_COMENTARIO);
    mockIsConfigured.mockReturnValue(false);

    const res = await new ExplanationService(
      prisma,
      quota,
      memoryCache(),
    ).explain('u1', 'q1');

    expect(res).toEqual({ explanation: null, source: null, available: false });
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('gera, grava com a origem da IA e devolve', async () => {
    const prisma = makePrisma() as any;
    prisma.question.findUnique.mockResolvedValue(SEM_COMENTARIO);
    mockIsConfigured.mockReturnValue(true);
    mockGenerate.mockResolvedValue('Comentário gerado.');

    const res = await new ExplanationService(
      prisma,
      quota,
      memoryCache(),
    ).explain('u1', 'q1');

    expect(res).toEqual({
      explanation: 'Comentário gerado.',
      source: 'ai:anthropic',
      available: true,
    });
    // Passa o gabarito oficial para a IA não inventar outro.
    expect(mockGenerate.mock.calls[0][0].correctLetter).toBe('B');
    // Só grava se ninguém gravou antes.
    expect(prisma.question.updateMany).toHaveBeenCalledWith({
      where: { id: 'q1', explanation: null },
      data: {
        explanation: 'Comentário gerado.',
        explanationSource: 'ai:anthropic',
      },
    });
  });

  it('pedidos simultâneos da mesma questão pagam UMA chamada só', async () => {
    const prisma = makePrisma() as any;
    prisma.question.findUnique.mockResolvedValue(SEM_COMENTARIO);
    mockIsConfigured.mockReturnValue(true);
    let resolver!: (v: string) => void;
    mockGenerate.mockReturnValue(
      new Promise<string>((r) => {
        resolver = r;
      }),
    );
    const service = new ExplanationService(prisma, quota, memoryCache());

    const a = service.explain('u1', 'q1');
    const b = service.explain('u1', 'q1');
    // Deixa as duas chegarem ao ponto de geração antes de resolver.
    await new Promise((r) => setImmediate(r));
    resolver('Único.');

    const [ra, rb] = await Promise.all([a, b]);
    expect(ra.explanation).toBe('Único.');
    expect(rb.explanation).toBe('Único.');
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it('se outra instância gravou primeiro, prevalece o comentário dela', async () => {
    const prisma = makePrisma() as any;
    prisma.question.findUnique
      .mockResolvedValueOnce(SEM_COMENTARIO)
      .mockResolvedValueOnce({
        explanation: 'Gravado antes.',
        explanationSource: 'ai:gemini',
      });
    prisma.question.updateMany.mockResolvedValue({ count: 0 });
    mockIsConfigured.mockReturnValue(true);
    mockGenerate.mockResolvedValue('Descartado.');

    const res = await new ExplanationService(
      prisma,
      quota,
      memoryCache(),
    ).explain('u1', 'q1');

    expect(res.explanation).toBe('Gravado antes.');
    expect(res.source).toBe('ai:gemini');
  });

  it('questão sem alternativa correta não é enviada à IA', async () => {
    const prisma = makePrisma() as any;
    prisma.question.findUnique.mockResolvedValue({
      ...SEM_COMENTARIO,
      alternatives: SEM_COMENTARIO.alternatives.map((a) => ({
        ...a,
        isCorrect: false,
      })),
    });
    mockIsConfigured.mockReturnValue(true);

    const res = await new ExplanationService(
      prisma,
      quota,
      memoryCache(),
    ).explain('u1', 'q1');

    expect(res.available).toBe(false);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('libera a questão depois de uma falha, para permitir nova tentativa', async () => {
    const prisma = makePrisma() as any;
    prisma.question.findUnique.mockResolvedValue(SEM_COMENTARIO);
    mockIsConfigured.mockReturnValue(true);
    mockGenerate
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce('Segunda tentativa.');
    const service = new ExplanationService(prisma, quota, memoryCache());

    await expect(service.explain('u1', 'q1')).rejects.toThrow('timeout');
    const res = await service.explain('u1', 'q1');

    expect(res.explanation).toBe('Segunda tentativa.');
  });

  describe('trava entre instâncias', () => {
    it('grava o comentário e apaga a questão do cache', async () => {
      const prisma = makePrisma() as any;
      prisma.question.findUnique.mockResolvedValue(SEM_COMENTARIO);
      mockIsConfigured.mockReturnValue(true);
      mockGenerate.mockResolvedValue('Novo.');
      const cache = memoryCache();
      await cache.set(questionCacheKey('q1'), { id: 'q1' }, 60_000, {
        ns: 'catalog',
      });

      await new ExplanationService(prisma, quota, cache).explain('u1', 'q1');

      await expect(
        cache.get(questionCacheKey('q1'), { ns: 'catalog' }),
      ).resolves.toBeUndefined();
    });

    it('solta a trava ao terminar, também depois de falha', async () => {
      const prisma = makePrisma() as any;
      prisma.question.findUnique.mockResolvedValue(SEM_COMENTARIO);
      mockIsConfigured.mockReturnValue(true);
      mockGenerate.mockRejectedValueOnce(new Error('timeout'));
      const cache = memoryCache();

      await expect(
        new ExplanationService(prisma, quota, cache).explain('u1', 'q1'),
      ).rejects.toThrow('timeout');
      await expect(cache.lock(['explanation', 'q1'], 1000)).resolves.toEqual(
        expect.any(String),
      );
    });

    it('com a trava de outra instância, espera o comentário dela no banco', async () => {
      const prisma = makePrisma() as any;
      prisma.question.findUnique
        .mockResolvedValueOnce(SEM_COMENTARIO)
        // primeira olhada: a outra ainda gera
        .mockResolvedValueOnce({ explanation: null, explanationSource: null })
        // segunda: gravou
        .mockResolvedValueOnce({
          explanation: 'Da outra instância.',
          explanationSource: 'ai:openai',
        });
      mockIsConfigured.mockReturnValue(true);
      const cache = memoryCache();
      // Outra instância segura a trava.
      await cache.lock(['explanation', 'q1'], 60_000);
      const service = new ExplanationService(prisma, quota, cache);
      service.esperar = jest.fn().mockResolvedValue(undefined);

      const res = await service.explain('u1', 'q1');

      expect(res).toEqual({
        explanation: 'Da outra instância.',
        source: 'ai:openai',
        available: true,
      });
      expect(mockGenerate).not.toHaveBeenCalled();
      expect(service.esperar).toHaveBeenCalledTimes(2);
    });

    it('se a trava da outra instância some sem comentário, gera', async () => {
      const prisma = makePrisma() as any;
      prisma.question.findUnique
        .mockResolvedValueOnce(SEM_COMENTARIO)
        .mockResolvedValue({ explanation: null, explanationSource: null });
      mockIsConfigured.mockReturnValue(true);
      mockGenerate.mockResolvedValue('Assumiu.');
      const cache = memoryCache();
      const dono = await cache.lock(['explanation', 'q1'], 60_000);
      const service = new ExplanationService(prisma, quota, cache);
      // Na primeira espera a outra instância cai e solta a trava.
      service.esperar = jest.fn(() =>
        cache.unlock(['explanation', 'q1'], dono!),
      );

      const res = await service.explain('u1', 'q1');

      expect(res.explanation).toBe('Assumiu.');
      expect(mockGenerate).toHaveBeenCalledTimes(1);
    });
  });
});
