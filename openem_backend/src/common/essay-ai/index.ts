// Correção de redação por IA (Fase 3).
//
// A escolha de provedor e a chamada em si vivem em `src/common/ai/`, que
// atende também o comentário e a classificação das questões oficiais. Aqui
// ficam só os prompts, o schema e a normalização das notas — o que é de
// redação. Nada muda para quem já configurou: ESSAY_AI_PROVIDER continua
// valendo, e o fallback para a rubrica manual segue igual.

import { activeAiProvider, completeJson, isAiConfigured } from '../ai';
import {
  AiEssayInput,
  AiEssayScores,
  buildUserPrompt,
  normalizeScores,
  OUTPUT_SCHEMA,
  SYSTEM_PROMPT,
} from './shared';

export type { AiEssayInput, AiEssayScores, EssayAiProvider } from './shared';

/** Provedor ativo para a correção de redação (null se não houver). */
export function activeEssayAiProvider() {
  return activeAiProvider('essay');
}

/** Indica se a correção por IA está configurada. */
export function isAiEssayConfigured(): boolean {
  return isAiConfigured('essay');
}

/**
 * Corrige uma redação com o provedor ativo e devolve as notas por competência +
 * feedback. Lança se nenhum provedor estiver configurado (o chamador trata como 503).
 */
export async function gradeEssayWithAi(
  input: AiEssayInput,
): Promise<AiEssayScores> {
  // Mensagem própria da redação: é ela que o essays.service traduz em 503.
  if (!isAiEssayConfigured()) {
    throw new Error('Nenhum provedor de IA de redação configurado');
  }
  const texto = await completeJson(
    {
      system: SYSTEM_PROMPT,
      user: buildUserPrompt(input),
      schema: OUTPUT_SCHEMA as unknown as Record<string, unknown>,
      schemaName: 'enem_essay_evaluation',
      maxTokens: 4096,
    },
    'essay',
  );
  return normalizeScores(texto);
}
