// Provedor genérico via Claude (Anthropic).

import Anthropic from '@anthropic-ai/sdk';
import { JsonCompletionRequest } from '../types';

export function isConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/** Executa a chamada e devolve o texto cru da resposta. */
export async function completeJson(
  req: JsonCompletionRequest,
): Promise<string> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: req.model ?? process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-8',
    max_tokens: req.maxTokens ?? 4096,
    thinking: { type: 'adaptive' },
    system: req.system,
    output_config: { format: { type: 'json_schema', schema: req.schema } },
    messages: [{ role: 'user', content: req.user }],
  });

  const text = response.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') {
    throw new Error('Resposta da IA (Anthropic) sem conteúdo de texto');
  }
  return text.text;
}
