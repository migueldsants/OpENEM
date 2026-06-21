// Correção de redação por IA (Fase 3) usando Claude (Anthropic).
// Mantém a mesma estrutura da rubrica manual (5 competências, 0..200) para que
// a avaliação gerada caiba no mesmo modelo EssayEvaluation.

import Anthropic from '@anthropic-ai/sdk';

export interface AiEssayInput {
  theme: string;
  instructions: string;
  content: string;
}

export interface AiEssayScores {
  c1: number;
  c2: number;
  c3: number;
  c4: number;
  c5: number;
  feedback: string;
}

/** Notas válidas por competência no ENEM (múltiplos de 40). */
const COMPETENCY_LEVELS = [0, 40, 80, 120, 160, 200];

const SYSTEM_PROMPT = `Você é um corretor experiente de redações do ENEM. Avalie a redação \
seguindo as cinco competências oficiais, atribuindo a cada uma uma nota entre 0 e 200 \
em múltiplos de 40 (0, 40, 80, 120, 160 ou 200):
- C1: domínio da norma culta da língua portuguesa.
- C2: compreender a proposta e aplicar conceitos das várias áreas (texto dissertativo-argumentativo).
- C3: selecionar, relacionar e organizar informações e argumentos.
- C4: conhecimento dos mecanismos linguísticos de coesão.
- C5: proposta de intervenção que respeite os direitos humanos.
Seja justo e criterioso. No campo "feedback", escreva um comentário objetivo em \
português (3 a 6 frases) destacando pontos fortes e o que melhorar.`;

const SCORE_ENUM = { type: 'integer', enum: COMPETENCY_LEVELS } as const;

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    c1: SCORE_ENUM,
    c2: SCORE_ENUM,
    c3: SCORE_ENUM,
    c4: SCORE_ENUM,
    c5: SCORE_ENUM,
    feedback: { type: 'string' },
  },
  required: ['c1', 'c2', 'c3', 'c4', 'c5', 'feedback'],
  additionalProperties: false,
} as const;

/** Indica se a correção por IA está configurada (há chave de API). */
export function isAiEssayConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/**
 * Corrige uma redação com o Claude e devolve as notas por competência + feedback.
 * Lança se a chave não estiver configurada (o chamador trata como 503).
 */
export async function gradeEssayWithAi(
  input: AiEssayInput,
): Promise<AiEssayScores> {
  if (!isAiEssayConfigured()) {
    throw new Error('ANTHROPIC_API_KEY não configurada');
  }

  const client = new Anthropic();
  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 4096,
    thinking: { type: 'adaptive' },
    system: SYSTEM_PROMPT,
    output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
    messages: [
      {
        role: 'user',
        content: `Tema: ${input.theme}\n\nInstruções: ${input.instructions}\n\nRedação do estudante:\n"""\n${input.content}\n"""`,
      },
    ],
  });

  const text = response.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') {
    throw new Error('Resposta da IA sem conteúdo de texto');
  }
  const parsed = JSON.parse(text.text) as AiEssayScores;
  // Sanitiza para garantir valores válidos mesmo diante de desvios do modelo.
  const clamp = (n: number) =>
    COMPETENCY_LEVELS.reduce((best, lvl) =>
      Math.abs(lvl - n) < Math.abs(best - n) ? lvl : best,
    );
  return {
    c1: clamp(parsed.c1),
    c2: clamp(parsed.c2),
    c3: clamp(parsed.c3),
    c4: clamp(parsed.c4),
    c5: clamp(parsed.c5),
    feedback: String(parsed.feedback ?? '').slice(0, 4000),
  };
}
