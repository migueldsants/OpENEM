// Provedor de IA de redação via OpenAI (e endpoints compatíveis com a API da OpenAI:
// Ollama, Groq, OpenRouter, LM Studio, vLLM…). Um único cliente atende os dois
// modos; a diferença é a base URL e o formato de resposta solicitado.

import type OpenAI from 'openai';
import {
  AiEssayInput,
  AiEssayScores,
  buildUserPrompt,
  normalizeScores,
  OUTPUT_SCHEMA,
  SYSTEM_PROMPT,
} from './shared';

/** Indica se o provedor OpenAI nativo está configurado. */
export function isConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/**
 * Indica se o endpoint compatível está configurado. Exige uma base URL própria;
 * a chave é opcional (servidores locais como Ollama não exigem autenticação).
 */
export function isCompatibleConfigured(): boolean {
  return !!process.env.OPENAI_BASE_URL;
}

/** Carrega o SDK da OpenAI sob demanda (dependência opcional). */
async function createClient(baseURL?: string) {
  const { default: OpenAIClient } = await import('openai');
  return new OpenAIClient({
    // Servidores compatíveis sem auth aceitam uma chave de espaço reservado.
    apiKey: process.env.OPENAI_API_KEY ?? 'not-required',
    ...(baseURL ? { baseURL } : {}),
  });
}

async function gradeWith(
  input: AiEssayInput,
  opts: { baseURL?: string; defaultModel: string; strictSchema: boolean },
): Promise<AiEssayScores> {
  const client = await createClient(opts.baseURL);
  const model = process.env.OPENAI_MODEL ?? opts.defaultModel;

  // Endpoints compatíveis nem sempre suportam json_schema; nesses casos pedimos
  // apenas json_object e reforçamos o formato no prompt do sistema.
  const responseFormat: OpenAI.Chat.Completions.ChatCompletionCreateParams['response_format'] =
    opts.strictSchema
      ? {
          type: 'json_schema',
          json_schema: {
            name: 'enem_essay_evaluation',
            schema: OUTPUT_SCHEMA as Record<string, unknown>,
            strict: true,
          },
        }
      : { type: 'json_object' };

  const system = opts.strictSchema
    ? SYSTEM_PROMPT
    : `${SYSTEM_PROMPT}\n\nResponda APENAS com um objeto JSON com as chaves \
"c1", "c2", "c3", "c4", "c5" (inteiros) e "feedback" (string). Sem texto fora do JSON.`;

  const response = await client.chat.completions.create({
    model,
    response_format: responseFormat,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: buildUserPrompt(input) },
    ],
  });

  const text = response.choices[0]?.message?.content;
  if (!text) {
    throw new Error('Resposta da IA (OpenAI) sem conteúdo de texto');
  }
  return normalizeScores(text);
}

/** Corrige a redação usando a API oficial da OpenAI. */
export function grade(input: AiEssayInput): Promise<AiEssayScores> {
  return gradeWith(input, { defaultModel: 'gpt-4o', strictSchema: true });
}

/** Corrige a redação usando um endpoint compatível com a OpenAI. */
export function gradeCompatible(input: AiEssayInput): Promise<AiEssayScores> {
  return gradeWith(input, {
    baseURL: process.env.OPENAI_BASE_URL,
    defaultModel: process.env.OPENAI_MODEL ?? 'llama3.1',
    strictSchema: false,
  });
}
