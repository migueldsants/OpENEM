// Provedor genérico via OpenAI e endpoints compatíveis (Ollama, Groq,
// OpenRouter, LM Studio, vLLM…). Um cliente só atende os dois modos; a
// diferença é a base URL e o formato de resposta que dá para pedir.

import type OpenAI from 'openai';
import { JsonCompletionRequest } from '../types';

export function isConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/**
 * O endpoint compatível exige uma base URL própria; a chave é opcional, porque
 * servidores locais como o Ollama não pedem autenticação.
 */
export function isCompatibleConfigured(): boolean {
  return !!process.env.OPENAI_BASE_URL;
}

/** Carrega o SDK sob demanda (dependência opcional). */
async function createClient(baseURL?: string) {
  const { default: OpenAIClient } = await import('openai');
  return new OpenAIClient({
    apiKey: process.env.OPENAI_API_KEY ?? 'not-required',
    ...(baseURL ? { baseURL } : {}),
  });
}

async function run(
  req: JsonCompletionRequest,
  opts: { baseURL?: string; defaultModel: string; strictSchema: boolean },
): Promise<string> {
  const client = await createClient(opts.baseURL);

  // Endpoints compatíveis nem sempre suportam json_schema: aí pedimos só
  // json_object e reforçamos o formato no prompt do sistema.
  const responseFormat: OpenAI.Chat.Completions.ChatCompletionCreateParams['response_format'] =
    opts.strictSchema
      ? {
          type: 'json_schema',
          json_schema: {
            name: req.schemaName,
            schema: req.schema,
            strict: true,
          },
        }
      : { type: 'json_object' };

  const system = opts.strictSchema
    ? req.system
    : `${req.system}\n\nResponda APENAS com um objeto JSON que siga este schema, ` +
      `sem nenhum texto fora do JSON:\n${JSON.stringify(req.schema)}`;

  const response = await client.chat.completions.create({
    model: req.model ?? process.env.OPENAI_MODEL ?? opts.defaultModel,
    ...(req.maxTokens ? { max_tokens: req.maxTokens } : {}),
    response_format: responseFormat,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: req.user },
    ],
  });

  const text = response.choices[0]?.message?.content;
  if (!text) {
    throw new Error('Resposta da IA (OpenAI) sem conteúdo de texto');
  }
  return text;
}

/** API oficial da OpenAI. */
export function completeJson(req: JsonCompletionRequest): Promise<string> {
  return run(req, { defaultModel: 'gpt-4o', strictSchema: true });
}

/** Endpoint compatível com a API da OpenAI. */
export function completeJsonCompatible(
  req: JsonCompletionRequest,
): Promise<string> {
  return run(req, {
    baseURL: process.env.OPENAI_BASE_URL,
    defaultModel: process.env.OPENAI_MODEL ?? 'llama3.1',
    strictSchema: false,
  });
}
