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
      new ExplanationService(prisma, quota).explain('u1', 'nao-existe'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('recusa pela cota do aluno antes de chamar a IA', async () => {
    mockIsConfigured.mockReturnValue(true);
    const prisma = makePrisma() as any;
    prisma.question.findUnique.mockResolvedValue(SEM_COMENTARIO);
    quota.reserve.mockRejectedValueOnce(new Error('cota'));
    await expect(
      new ExplanationService(prisma, quota).explain('u1', 'q1'),
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
    await new ExplanationService(prisma, quota).explain('u1', 'q1');
    expect(quota.reserve).not.toHaveBeenCalled();
  });

  it('devolve o comentário existente sem chamar a IA', async () => {
    const prisma = makePrisma() as any;
    prisma.question.findUnique.mockResolvedValue({
      ...SEM_COMENTARIO,
      explanation: 'Já comentada.',
      explanationSource: 'humano',
    });

    const res = await new ExplanationService(prisma, quota).explain('u1', 'q1');

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

    const res = await new ExplanationService(prisma, quota).explain('u1', 'q1');

    expect(res).toEqual({ explanation: null, source: null, available: false });
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('gera, grava com a origem da IA e devolve', async () => {
    const prisma = makePrisma() as any;
    prisma.question.findUnique.mockResolvedValue(SEM_COMENTARIO);
    mockIsConfigured.mockReturnValue(true);
    mockGenerate.mockResolvedValue('Comentário gerado.');

    const res = await new ExplanationService(prisma, quota).explain('u1', 'q1');

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
    const service = new ExplanationService(prisma, quota);

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

    const res = await new ExplanationService(prisma, quota).explain('u1', 'q1');

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

    const res = await new ExplanationService(prisma, quota).explain('u1', 'q1');

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
    const service = new ExplanationService(prisma, quota);

    await expect(service.explain('u1', 'q1')).rejects.toThrow('timeout');
    const res = await service.explain('u1', 'q1');

    expect(res.explanation).toBe('Segunda tentativa.');
  });
});
