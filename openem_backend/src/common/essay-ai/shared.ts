// Tipos e utilidades compartilhados entre os provedores de IA de redação.
// Todos os provedores produzem a mesma estrutura (5 competências 0..200 +
// feedback geral + resumo por competência + anotações por erro) para que a
// avaliação caiba no mesmo modelo EssayEvaluation.

export interface AiEssayInput {
  theme: string;
  instructions: string;
  content: string;
}

/** Resumo por competência (o que melhorar em cada uma). */
export interface CompetencyFeedback {
  c1: string;
  c2: string;
  c3: string;
  c4: string;
  c5: string;
}

/** Anotação de erro como vem do modelo (apenas o trecho citado, sem offsets). */
export interface RawAnnotation {
  competency: number; // 1..5
  excerpt: string; // trecho literal da redação
  comment: string; // o que está errado
  suggestion: string; // como melhorar
}

export interface AiEssayScores {
  c1: number;
  c2: number;
  c3: number;
  c4: number;
  c5: number;
  feedback: string;
  competencyFeedback: CompetencyFeedback;
  annotations: RawAnnotation[];
}

/** Identificadores dos provedores suportados. */
export type EssayAiProvider =
  | 'anthropic'
  | 'openai'
  | 'openai-compatible'
  | 'gemini';

/** Notas válidas por competência no ENEM (múltiplos de 40). */
export const COMPETENCY_LEVELS = [0, 40, 80, 120, 160, 200] as const;

export const SYSTEM_PROMPT = `Você é um corretor experiente de redações do ENEM. Avalie a redação \
seguindo as cinco competências oficiais, atribuindo a cada uma uma nota entre 0 e 200 \
em múltiplos de 40 (0, 40, 80, 120, 160 ou 200):
- C1: domínio da norma culta da língua portuguesa.
- C2: compreender a proposta e aplicar conceitos das várias áreas (texto dissertativo-argumentativo).
- C3: selecionar, relacionar e organizar informações e argumentos.
- C4: conhecimento dos mecanismos linguísticos de coesão.
- C5: proposta de intervenção que respeite os direitos humanos.

Devolva:
- As cinco notas (c1..c5).
- "feedback": um comentário geral objetivo em português (3 a 6 frases) com pontos fortes e o que melhorar.
- "competencyFeedback": para CADA competência (c1..c5), 1 a 2 frases dizendo o que melhorar nela.
- "annotations": uma lista dos principais problemas encontrados. Para cada problema, informe:
  - "excerpt": copie LITERALMENTE o trecho exato da redação onde o problema ocorre \
(mesma grafia, acentuação e pontuação do texto original; não parafraseie nem corrija o trecho).
  - "competency": a competência (1 a 5) à qual o problema se refere.
  - "comment": uma frase curta explicando o erro.
  - "suggestion": uma frase curta sugerindo como corrigir.
Aponte os erros mais relevantes (até cerca de 12). Seja justo e criterioso.`;

const SCORE_PROP = { type: 'integer', enum: [...COMPETENCY_LEVELS] } as const;
const STRING_PROP = { type: 'string' } as const;

/** Schema JSON da resposta esperada (formato JSON Schema, reutilizado por vários SDKs). */
export const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    c1: SCORE_PROP,
    c2: SCORE_PROP,
    c3: SCORE_PROP,
    c4: SCORE_PROP,
    c5: SCORE_PROP,
    feedback: STRING_PROP,
    competencyFeedback: {
      type: 'object',
      properties: {
        c1: STRING_PROP,
        c2: STRING_PROP,
        c3: STRING_PROP,
        c4: STRING_PROP,
        c5: STRING_PROP,
      },
      required: ['c1', 'c2', 'c3', 'c4', 'c5'],
      additionalProperties: false,
    },
    annotations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          competency: { type: 'integer', enum: [1, 2, 3, 4, 5] },
          excerpt: STRING_PROP,
          comment: STRING_PROP,
          suggestion: STRING_PROP,
        },
        required: ['competency', 'excerpt', 'comment', 'suggestion'],
        additionalProperties: false,
      },
    },
  },
  required: [
    'c1',
    'c2',
    'c3',
    'c4',
    'c5',
    'feedback',
    'competencyFeedback',
    'annotations',
  ],
  additionalProperties: false,
} as const;

/** Mensagem do usuário com o tema, as instruções e a redação. */
export function buildUserPrompt(input: AiEssayInput): string {
  return `Tema: ${input.theme}\n\nInstruções: ${input.instructions}\n\nRedação do estudante:\n"""\n${input.content}\n"""`;
}

/** Aproxima um valor à nota de competência válida mais próxima. */
function clampToLevel(n: number): number {
  return COMPETENCY_LEVELS.reduce((best, lvl) =>
    Math.abs(lvl - n) < Math.abs(best - n) ? lvl : best,
  );
}

/** Coage para string apenas valores primitivos; objetos/arrays viram ''. */
function asString(v: unknown): string {
  return typeof v === 'string'
    ? v
    : typeof v === 'number' || typeof v === 'boolean'
      ? String(v)
      : '';
}

function normalizeCompetencyFeedback(raw: unknown): CompetencyFeedback {
  const o = (raw ?? {}) as Record<string, unknown>;
  const s = (v: unknown) => asString(v).slice(0, 1000);
  return { c1: s(o.c1), c2: s(o.c2), c3: s(o.c3), c4: s(o.c4), c5: s(o.c5) };
}

function normalizeAnnotations(raw: unknown): RawAnnotation[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((a) => a as Record<string, unknown>)
    .filter((a) => a && typeof a === 'object')
    .map((a) => ({
      competency: Math.round(Number(a.competency)),
      excerpt: asString(a.excerpt).slice(0, 2000),
      comment: asString(a.comment).slice(0, 1000),
      suggestion: asString(a.suggestion).slice(0, 1000),
    }))
    .filter(
      (a) =>
        a.competency >= 1 &&
        a.competency <= 5 &&
        a.excerpt.trim().length > 0 &&
        a.comment.trim().length > 0,
    )
    .slice(0, 20);
}

/**
 * Sanitiza a saída crua do modelo: garante notas válidas mesmo diante de
 * desvios, limita tamanhos e normaliza feedback/anotações. Aceita texto JSON ou
 * objeto já parseado.
 */
export function normalizeScores(
  raw: string | Record<string, unknown>,
): AiEssayScores {
  const parsed = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Record<
    string,
    unknown
  >;
  return {
    c1: clampToLevel(Number(parsed.c1)),
    c2: clampToLevel(Number(parsed.c2)),
    c3: clampToLevel(Number(parsed.c3)),
    c4: clampToLevel(Number(parsed.c4)),
    c5: clampToLevel(Number(parsed.c5)),
    feedback: asString(parsed.feedback).slice(0, 4000),
    competencyFeedback: normalizeCompetencyFeedback(parsed.competencyFeedback),
    annotations: normalizeAnnotations(parsed.annotations),
  };
}
