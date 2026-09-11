// Provedor genérico via Google Gemini (@google/genai).

import { JsonCompletionRequest } from '../types';
import { toGeminiSchema } from './gemini-schema';

/** Aceita GEMINI_API_KEY ou GOOGLE_API_KEY. */
function apiKey(): string | undefined {
  return process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
}

export function isConfigured(): boolean {
  return !!apiKey();
}

/** Executa a chamada e devolve o texto cru da resposta. */
export async function completeJson(
  req: JsonCompletionRequest,
): Promise<string> {
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: apiKey() });

  const response = await ai.models.generateContent({
    model: req.model ?? process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
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
