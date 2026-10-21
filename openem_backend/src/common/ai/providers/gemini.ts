// Provedor genérico via Google Gemini (@google/genai).

import { envValue, firstPresent } from '../env';
import { JsonCompletionRequest } from '../types';
import { toGeminiSchema } from './gemini-schema';

/** Aceita GEMINI_API_KEY ou GOOGLE_API_KEY. */
export function apiKey(): string | undefined {
  return envValue('GEMINI_API_KEY') ?? envValue('GOOGLE_API_KEY');
}

export function isConfigured(): boolean {
  return !!apiKey();
}

/** Modelo da chamada: o do pedido, o do .env ou o padrão. */
export function model(req: Pick<JsonCompletionRequest, 'model'>): string {
  return (
    firstPresent(req.model, envValue('GEMINI_MODEL')) ?? 'gemini-2.5-flash'
  );
}

/** Executa a chamada e devolve o texto cru da resposta. */
export async function completeJson(
  req: JsonCompletionRequest,
): Promise<string> {
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: apiKey() });

  const response = await ai.models.generateContent({
    model: model(req),
    contents: req.user,
    config: {
      systemInstruction: req.system,
      responseMimeType: 'application/json',
      // O schema vem do mesmo JSON Schema usado pelos outros provedores.
      responseSchema: toGeminiSchema(req.schema),
      ...(req.maxTokens ? { maxOutputTokens: req.maxTokens } : {}),
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error('Resposta da IA (Gemini) sem conteúdo de texto');
  }
  return text;
}
