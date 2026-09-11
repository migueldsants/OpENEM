/**
 * Comentário de questão gerado por IA.
 *
 * As provas oficiais do ENEM chegam sem comentário. Em vez de gerar os
 * milhares de uma vez — a maioria nunca seria lida, e o projeto é gratuito —,
 * o comentário é pedido na primeira vez que alguém abre o gabarito e fica
 * gravado para os próximos alunos.
 *
 * Aqui ficam só o prompt, o schema e a validação; a chamada vai pela camada
 * genérica em `./index.ts`.
 */

import { completeJson, JsonCompletionRequest } from './index';

export interface ExplanationInput {
  statement: string;
  questionPrompt: string | null;
  alternatives: { letter: string; text: string; hasImage: boolean }[];
  correctLetter: string;
  areaName: string | null;
  topicName: string | null;
  examLabel: string | null;
}

/** Limite do comentário gravado — o suficiente para 3–6 parágrafos curtos. */
export const MAX_EXPLANATION_CHARS = 4000;

export const EXPLANATION_SYSTEM_PROMPT = `Você é um professor experiente que \
prepara alunos para o ENEM. Escreva o comentário de uma questão oficial, em \
português do Brasil, para um aluno do ensino médio.

Regras:
- Explique por que a alternativa correta está correta, apoiando-se no enunciado.
- Depois, diga em uma frase por que cada uma das outras alternativas está errada.
- Não invente dados que não estejam no enunciado. Se a questão depende de uma \
figura que você não pode ver, diga isso com honestidade em vez de adivinhar o \
que ela mostra.
- Seja direto: de 3 a 6 parágrafos curtos. Use Markdown leve (negrito, listas).
- Fórmulas em LaTeX entre $...$ (em linha) ou $$...$$ (em bloco).
- Nunca contradiga o gabarito informado: ele é o oficial.`;

export const EXPLANATION_SCHEMA = {
  type: 'object',
  properties: {
    explanation: {
      type: 'string',
      description: 'O comentário da questão, em Markdown.',
    },
  },
  required: ['explanation'],
  additionalProperties: false,
} as const;

/** Monta a mensagem do usuário com tudo o que o modelo precisa ver. */
export function buildExplanationPrompt(input: ExplanationInput): string {
  const cabecalho = [
    input.examLabel && `Prova: ${input.examLabel}`,
    input.areaName && `Área: ${input.areaName}`,
    input.topicName && `Assunto: ${input.topicName}`,
  ]
    .filter(Boolean)
    .join('\n');

  const alternativas = input.alternatives
    .map((a) => {
      const texto = a.text || (a.hasImage ? '[alternativa em imagem]' : '');
      return `${a.letter}) ${texto}`;
    })
    .join('\n');

  return [
    cabecalho,
    `Enunciado:\n${input.statement}`,
    input.questionPrompt && `Comando:\n${input.questionPrompt}`,
    `Alternativas:\n${alternativas}`,
    `Gabarito oficial: ${input.correctLetter}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Extrai o comentário da resposta da IA. Lança se a resposta não servir:
 * gravar um comentário vazio ou quebrado seria pior do que não ter nenhum,
 * porque impediria uma nova tentativa.
 */
export function normalizeExplanation(raw: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Resposta da IA não é JSON válido');
  }
  const texto =
    parsed && typeof parsed === 'object' && 'explanation' in parsed
      ? (parsed as { explanation: unknown }).explanation
      : undefined;
  if (typeof texto !== 'string' || !texto.trim()) {
    throw new Error('Resposta da IA sem comentário');
  }
  const limpo = texto.trim();
  return limpo.length > MAX_EXPLANATION_CHARS
    ? `${limpo.slice(0, MAX_EXPLANATION_CHARS).trimEnd()}…`
    : limpo;
}

/** Gera o comentário. `complete` é injetável para o teste não chamar a rede. */
export async function generateExplanation(
  input: ExplanationInput,
  complete: (req: JsonCompletionRequest) => Promise<string> = completeJson,
): Promise<string> {
  const raw = await complete({
    system: EXPLANATION_SYSTEM_PROMPT,
    user: buildExplanationPrompt(input),
    schema: EXPLANATION_SCHEMA as unknown as Record<string, unknown>,
    schemaName: 'enem_question_explanation',
    maxTokens: 2048,
    model: process.env.AI_EXPLANATION_MODEL,
  });
  return normalizeExplanation(raw);
}
