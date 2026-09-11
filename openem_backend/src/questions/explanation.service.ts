import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { activeAiProvider, isAiConfigured } from '../common/ai';
import { generateExplanation } from '../common/ai/explanation';
import { PrismaService } from '../prisma/prisma.service';

export interface ExplanationResult {
  explanation: string | null;
  /** "seed" | "humano" | "ai:<provedor>" — a UI avisa quando é IA. */
  source: string | null;
  /** false quando não há comentário E não há provedor de IA para gerar um. */
  available: boolean;
}

/**
 * Comentário de questão sob demanda.
 *
 * Gera na primeira vez que alguém pede e grava para os próximos. Fica fora do
 * `POST /answers` de propósito: uma chamada de IA de vários segundos travaria o
 * player, que hoje responde na hora, e a maioria dos alunos nem abre o
 * comentário — gerar para toda questão respondida seria gastar à toa.
 */
@Injectable()
export class ExplanationService {
  private readonly logger = new Logger(ExplanationService.name);
  /**
   * Gerações em andamento, por questão. Dois alunos abrindo o mesmo gabarito
   * ao mesmo tempo esperam a mesma chamada em vez de pagar por duas. Com várias
   * instâncias do backend ainda pode haver geração duplicada — custo a mais,
   * nunca dado corrompido, porque a gravação é idempotente.
   */
  private readonly emAndamento = new Map<string, Promise<ExplanationResult>>();

  constructor(private readonly prisma: PrismaService) {}

  async explain(questionId: string): Promise<ExplanationResult> {
    const questao = await this.prisma.question.findUnique({
      where: { id: questionId },
      select: {
        id: true,
        statement: true,
        questionPrompt: true,
        explanation: true,
        explanationSource: true,
        subjectArea: { select: { name: true } },
        topic: { select: { name: true } },
        examYear: { select: { label: true } },
        alternatives: {
          select: { letter: true, text: true, imageUrl: true, isCorrect: true },
          orderBy: { position: 'asc' },
        },
      },
    });
    if (!questao) {
      throw new NotFoundException('Questão não encontrada');
    }

    if (questao.explanation) {
      return {
        explanation: questao.explanation,
        source: questao.explanationSource,
        available: true,
      };
    }

    // Sem provedor: 200 com available=false, não 503. Não é uma ação que falhou,
    // é um recurso desligado — e um erro poluiria a fila offline do PWA.
    if (!isAiConfigured()) {
      return { explanation: null, source: null, available: false };
    }

    const pendente = this.emAndamento.get(questionId);
    if (pendente) return pendente;

    const tarefa = this.gerar(questao).finally(() =>
      this.emAndamento.delete(questionId),
    );
    this.emAndamento.set(questionId, tarefa);
    return tarefa;
  }

  private async gerar(questao: {
    id: string;
    statement: string;
    questionPrompt: string | null;
    subjectArea: { name: string } | null;
    topic: { name: string } | null;
    examYear: { label: string } | null;
    alternatives: {
      letter: string | null;
      text: string;
      imageUrl: string | null;
      isCorrect: boolean;
    }[];
  }): Promise<ExplanationResult> {
    const letras = 'ABCDEFGH';
    const alternativas = questao.alternatives.map((a, i) => ({
      letter: a.letter ?? letras[i],
      text: a.text,
      hasImage: !!a.imageUrl,
    }));
    const correta = questao.alternatives.findIndex((a) => a.isCorrect);
    if (correta < 0) {
      // Sem gabarito não há o que explicar — e a IA inventaria um.
      return { explanation: null, source: null, available: false };
    }

    const explanation = await generateExplanation({
      statement: questao.statement,
      questionPrompt: questao.questionPrompt,
      alternatives: alternativas,
      correctLetter: alternativas[correta].letter,
      areaName: questao.subjectArea?.name ?? null,
      topicName: questao.topic?.name ?? null,
      examLabel: questao.examYear?.label ?? null,
    });

    const source = `ai:${activeAiProvider()}`;
    // updateMany com `explanation: null` no filtro: se outra instância gravou
    // primeiro, a dela prevalece e esta geração é descartada.
    const { count } = await this.prisma.question.updateMany({
      where: { id: questao.id, explanation: null },
      data: { explanation, explanationSource: source },
    });
    if (count === 0) {
      const atual = await this.prisma.question.findUnique({
        where: { id: questao.id },
        select: { explanation: true, explanationSource: true },
      });
      return {
        explanation: atual?.explanation ?? explanation,
        source: atual?.explanationSource ?? source,
        available: true,
      };
    }
    this.logger.log(
      `comentário gerado para a questão ${questao.id} (${source})`,
    );
    return { explanation, source, available: true };
  }
}
