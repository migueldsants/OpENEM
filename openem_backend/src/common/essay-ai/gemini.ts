// Provedor de IA de redação via Google Gemini (@google/genai).

import {
  AiEssayInput,
  AiEssayScores,
  buildUserPrompt,
  normalizeScores,
  SYSTEM_PROMPT,
} from './shared';

/** Aceita GEMINI_API_KEY ou GOOGLE_API_KEY. */
function apiKey(): string | undefined {
  return process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
}

/** Indica se o provedor Gemini está configurado. */
export function isConfigured(): boolean {
  return !!apiKey();
}

/** Corrige a redação com o Gemini. */
export async function grade(input: AiEssayInput): Promise<AiEssayScores> {
  const { GoogleGenAI, Type } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: apiKey() });
  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';

  // Schema no formato do Gemini. As notas saem como inteiros; normalizeScores
  // aproxima ao múltiplo de 40 válido mais próximo.
  const score = { type: Type.INTEGER };
  const str = { type: Type.STRING };
  const response = await ai.models.generateContent({
    model,
    contents: buildUserPrompt(input),
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          c1: score,
          c2: score,
          c3: score,
          c4: score,
          c5: score,
          feedback: str,
          competencyFeedback: {
            type: Type.OBJECT,
            properties: { c1: str, c2: str, c3: str, c4: str, c5: str },
            required: ['c1', 'c2', 'c3', 'c4', 'c5'],
          },
          annotations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                competency: { type: Type.INTEGER },
                excerpt: str,
                comment: str,
                suggestion: str,
              },
              required: ['competency', 'excerpt', 'comment', 'suggestion'],
            },
          },
        },
        required: [
          'c1',
          'c2',
          'c3',
          'c4',
          'c5',
          'feedback',
          'competencyFeedback',
          'annotations',
        ],
      },
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error('Resposta da IA (Gemini) sem conteúdo de texto');
  }
  return normalizeScores(text);
}
