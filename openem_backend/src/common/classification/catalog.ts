/**
 * Catálogo de assuntos das questões oficiais (`prisma/classificacao-assuntos.json`).
 *
 * É a classificação por IA feita uma vez e versionada no repositório: o
 * assunto de cada questão que a classificação por palavra-chave não decidiu,
 * escolhido pelo Claude Haiku 5.5 na lista de assuntos da área. Assim o banco
 * de um deploy novo nasce classificado sem precisar de chave de IA.
 *
 * NÃO é dado oficial: o INEP não publica o assunto das questões.
 */

/** Uma questão no catálogo, pelo `externalId`. */
export interface CatalogEntry {
  /** Rótulo "Matéria / Assunto", como em `topicLabel`. */
  assunto: string;
  /** Confiança da classificação, de 0 a 1. */
  confianca: number;
}

/** Abaixo disso a classificação não é gravada — o mesmo corte do db:classify. */
export const CATALOG_MIN_CONFIDENCE = 0.6;

/** Valor de `Question.classificationSource` para o que veio do catálogo. */
export const CATALOG_SOURCE = 'catalogo:claude-haiku';

export interface CatalogQuestion {
  externalId: string;
  subjectAreaId: string | null;
  topicId: string | null;
}

export interface CatalogTopic {
  id: string;
  subjectAreaId: string;
}

export interface CatalogDecision {
  externalId: string;
  topicId: string;
  confidence: number;
}

export type CatalogSkipReason =
  | 'baixa confiança'
  | 'assunto inexistente'
  | 'área divergente';

/**
 * O que aplicar do catálogo. A questão que já tem assunto fica como está — a
 * palavra-chave, a IA do próprio deploy ou uma correção manual vêm antes —, e
 * nada do catálogo é aceito sem conferência: assunto fora da taxonomia (um
 * tema renomeado) ou de outra área (a área da questão mudou) é ignorado e
 * contado, nunca gravado.
 */
export function catalogDecisions(
  catalogo: Record<string, CatalogEntry>,
  questoes: CatalogQuestion[],
  topicosPorRotulo: Map<string, CatalogTopic>,
  minConfianca = CATALOG_MIN_CONFIDENCE,
): {
  aplicar: CatalogDecision[];
  ignoradas: { externalId: string; motivo: CatalogSkipReason }[];
} {
  const aplicar: CatalogDecision[] = [];
  const ignoradas: { externalId: string; motivo: CatalogSkipReason }[] = [];
  for (const q of questoes) {
    if (q.topicId) continue;
    const entrada = catalogo[q.externalId];
    if (!entrada) continue;
    if (!(entrada.confianca >= minConfianca)) {
      ignoradas.push({ externalId: q.externalId, motivo: 'baixa confiança' });
      continue;
    }
    const topico = topicosPorRotulo.get(entrada.assunto);
    if (!topico) {
      ignoradas.push({
        externalId: q.externalId,
        motivo: 'assunto inexistente',
      });
      continue;
    }
    if (topico.subjectAreaId !== q.subjectAreaId) {
      ignoradas.push({ externalId: q.externalId, motivo: 'área divergente' });
      continue;
    }
    aplicar.push({
      externalId: q.externalId,
      topicId: topico.id,
      confidence: entrada.confianca,
    });
  }
  return { aplicar, ignoradas };
}
