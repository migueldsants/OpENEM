/**
 * Catálogo de assuntos das questões oficiais (`prisma/classificacao-assuntos.json`).
 *
 * É a classificação por IA feita uma vez e versionada no repositório: o
 * assunto de cada questão que a classificação por palavra-chave não decidiu ou
 * decidiu com pouca folga, escolhido pelo Claude Haiku 5.5 na lista de assuntos
 * da área. Assim o banco de um deploy novo nasce classificado sem precisar de
 * chave de IA.
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

/** Valor de `Question.classificationSource` da classificação por palavra-chave. */
export const KEYWORDS_SOURCE = 'keywords';

/**
 * Confiança a partir da qual a palavra-chave vale mais que o catálogo.
 *
 * Numa revisão à mão de 184 decisões por palavra-chave (nov/2026), 12% estavam
 * erradas, todas com confiança entre 0,60 e 0,68; das 25 com 0,70 ou mais,
 * nenhuma. Abaixo do corte a palavra-chave acertava o vocabulário do texto,
 * não o que a questão cobra (um texto sobre futebol cuja pergunta é de registro
 * da língua virava Educação Física), então o catálogo, que leu a questão
 * inteira, toma o lugar dela.
 */
export const KEYWORDS_TRUSTED_CONFIDENCE = 0.7;

export interface CatalogQuestion {
  externalId: string;
  subjectAreaId: string | null;
  topicId: string | null;
  classificationSource?: string | null;
  classificationConfidence?: number | null;
}

/**
 * O catálogo pode gravar nesta questão? Sim se ela não tem assunto ou se o
 * assunto veio da palavra-chave com confiança abaixo de
 * `KEYWORDS_TRUSTED_CONFIDENCE`. Qualquer outro assunto (palavra-chave
 * confiável, IA do próprio deploy, correção manual) fica como está.
 */
export function catalogMayReplace(q: CatalogQuestion): boolean {
  if (!q.topicId) return true;
  return (
    q.classificationSource === KEYWORDS_SOURCE &&
    (q.classificationConfidence ?? 0) < KEYWORDS_TRUSTED_CONFIDENCE
  );
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
 * O que aplicar do catálogo. A questão que já tem assunto fica como está, salvo
 * a decisão de palavra-chave com pouca folga (`catalogMayReplace`), e nada do
 * catálogo é aceito sem conferência: assunto fora da taxonomia (um
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
    if (!catalogMayReplace(q)) continue;
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
