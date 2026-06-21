// Provedor de IA de redação via Claude (Anthropic).

import Anthropic from '@anthropic-ai/sdk';
import {
  AiEssayInput,
  AiEssayScores,
  buildUserPrompt,
  normalizeScores,
  OUTPUT_SCHEMA,
  SYSTEM_PROMPT,
} from './shared';

/** Indica se o provedor Anthropic está configurado. */
export function isConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/** Corrige a redação com o Claude. */
export async function grade(input: AiEssayInput): Promise<AiEssayScores> {
  const client = new Anthropic();
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-8';
  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    thinking: { type: 'adaptive' },
    system: SYSTEM_PROMPT,
    output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
    messages: [{ role: 'user', content: buildUserPrompt(input) }],
  });

  const text = response.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') {
    throw new Error('Resposta da IA (Anthropic) sem conteúdo de texto');
  }
  return normalizeScores(text.text);
}
