import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AnswersService } from './answers.service';

function makePrismaMock() {
  return {
    question: {
      findUnique: jest.fn(),
    },
    simulation: {
      findUnique: jest.fn(),
    },
    answer: {
      create: jest.fn(),
    },
  };
}

function makeService() {
  const prisma = makePrismaMock() as any;
  const review = { recordOutcome: jest.fn().mockResolvedValue(undefined) };
  const gamification = {
    recordAnswer: jest.fn().mockResolvedValue(null),
  };
  const service = new AnswersService(prisma, review, gamification);
  return { service, prisma, review, gamification };
}

const QUESTION = {
  id: 'q1',
  topicId: 't1',
  explanation: 'explicação',
  alternatives: [
    { id: 'a1', isCorrect: false },
    { id: 'a2', isCorrect: true },
  ],
};

describe('AnswersService', () => {
  describe('create()', () => {
    it('retorna 404 para questão inexistente', async () => {
      const { service, prisma } = makeService();
      prisma.question.findUnique.mockResolvedValue(null);
      await expect(
        service.create('u1', { questionId: 'nao-existe' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('corrige acerto e registra resposta sem simulado', async () => {
      const { service, prisma, review, gamification } = makeService();
      prisma.question.findUnique.mockResolvedValue(QUESTION);
      prisma.answer.create.mockResolvedValue({});

      const res = await service.create('u1', {
        questionId: 'q1',
        chosenId: 'a2',
        timeSpentSec: 10,
      });

      expect(res.isCorrect).toBe(true);
      expect(res.correctAlternativeId).toBe('a2');
      expect(res.explanation).toBe('explicação');
      expect(prisma.answer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'u1',
          questionId: 'q1',
          chosenId: 'a2',
          isCorrect: true,
          timeSpentSec: 10,
          simulationId: undefined,
        }),
      });
      expect(review.recordOutcome).toHaveBeenCalledWith('u1', 't1', true);
      expect(gamification.recordAnswer).toHaveBeenCalledWith('u1', true);
    });

    it('corrige erro e alternativa em branco', async () => {
      const { service, prisma } = makeService();
      prisma.question.findUnique.mockResolvedValue(QUESTION);
      prisma.answer.create.mockResolvedValue({});

      const wrong = await service.create('u1', {
        questionId: 'q1',
        chosenId: 'a1',
      });
      expect(wrong.isCorrect).toBe(false);

      const blank = await service.create('u1', { questionId: 'q1' });
      expect(blank.isCorrect).toBe(false);
      expect(blank.correctAlternativeId).toBe('a2');
    });

    describe('validação de simulationId (issue #49)', () => {
      it('retorna 404 quando o simulado não existe', async () => {
        const { service, prisma } = makeService();
        prisma.question.findUnique.mockResolvedValue(QUESTION);
        prisma.simulation.findUnique.mockResolvedValue(null);

        await expect(
          service.create('u1', {
            questionId: 'q1',
            simulationId: 'nao-existe',
          }),
        ).rejects.toBeInstanceOf(NotFoundException);
        expect(prisma.answer.create).not.toHaveBeenCalled();
      });

      it('retorna 403 quando o simulado pertence a outro usuário', async () => {
        const { service, prisma } = makeService();
        prisma.question.findUnique.mockResolvedValue(QUESTION);
        prisma.simulation.findUnique.mockResolvedValue({
          userId: 'outro',
          finishedAt: null,
        });

        await expect(
          service.create('u1', { questionId: 'q1', simulationId: 'sim-outro' }),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(prisma.answer.create).not.toHaveBeenCalled();
      });

      it('retorna 400 quando o simulado já foi finalizado', async () => {
        const { service, prisma } = makeService();
        prisma.question.findUnique.mockResolvedValue(QUESTION);
        prisma.simulation.findUnique.mockResolvedValue({
          userId: 'u1',
          finishedAt: new Date(),
        });

        await expect(
          service.create('u1', { questionId: 'q1', simulationId: 'sim-fin' }),
        ).rejects.toThrow('Simulado já finalizado');
        expect(prisma.answer.create).not.toHaveBeenCalled();
      });

      it('aceita simulado próprio em andamento', async () => {
        const { service, prisma } = makeService();
        prisma.question.findUnique.mockResolvedValue(QUESTION);
        prisma.simulation.findUnique.mockResolvedValue({
          userId: 'u1',
          finishedAt: null,
        });
        prisma.answer.create.mockResolvedValue({});

        const res = await service.create('u1', {
          questionId: 'q1',
          chosenId: 'a2',
          simulationId: 'sim-meu',
        });
        expect(res.isCorrect).toBe(true);
        expect(prisma.answer.create).toHaveBeenCalledWith({
          data: expect.objectContaining({ simulationId: 'sim-meu' }),
        });
      });
    });
  });
});

// As questões oficiais do ENEM entram com área e sem assunto classificado.
// Nesse caso não há assunto que a revisão espaçada possa reagendar.
describe('AnswersService.create() — questão sem assunto classificado', () => {
  const SEM_TOPICO = { ...QUESTION, topicId: null, explanation: null };

  it('não chama recordOutcome quando topicId é nulo', async () => {
    const { service, prisma, review, gamification } = makeService();
    prisma.question.findUnique.mockResolvedValue(SEM_TOPICO);
    prisma.answer.create.mockResolvedValue({});

    const res = await service.create('u1', {
      questionId: 'q1',
      chosenId: 'a2',
    });

    expect(res.isCorrect).toBe(true);
    expect(review.recordOutcome).not.toHaveBeenCalled();
    // A gamificação continua valendo: o aluno respondeu.
    expect(gamification.recordAnswer).toHaveBeenCalledWith('u1', true);
  });

  it('devolve explanation nula sem quebrar', async () => {
    const { service, prisma } = makeService();
    prisma.question.findUnique.mockResolvedValue(SEM_TOPICO);
    prisma.answer.create.mockResolvedValue({});

    const res = await service.create('u1', {
      questionId: 'q1',
      chosenId: 'a1',
    });

    expect(res.isCorrect).toBe(false);
    expect(res.explanation).toBeNull();
  });
});
