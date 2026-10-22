// Provedor genérico via Claude (Anthropic).

import Anthropic from '@anthropic-ai/sdk';
import { envValue, firstPresent } from '../env';
import { JsonCompletionRequest } from '../types';

export function isConfigured(): boolean {
  return !!envValue('ANTHROPIC_API_KEY');
}

/** Modelo da chamada: o do pedido, o do .env ou o padrão. */
export function model(req: Pick<JsonCompletionRequest, 'model'>): string {
  return (
    firstPresent(req.model, envValue('ANTHROPIC_MODEL')) ?? 'claude-opus-4-8'
  );
}

/** Executa a chamada e devolve o texto cru da resposta. */
export async function completeJson(
  req: JsonCompletionRequest,
): Promise<string> {
  const client = new Anthropic({ apiKey: envValue('ANTHROPIC_API_KEY') });
  const response = await client.messages.create({
    model: model(req),
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
