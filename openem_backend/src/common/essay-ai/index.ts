// Correção de redação por IA (Fase 3) com provedores opcionais e intercambiáveis.
//
// O provedor é escolhido por ESSAY_AI_PROVIDER (anthropic | openai |
// openai-compatible | gemini). Sem essa variável, detecta automaticamente o
// primeiro provedor configurado (nesta ordem de prioridade). Cada provedor é
// gated pela sua própria chave/URL; sem nenhum configurado a correção por IA
// fica indisponível e o app recai na rubrica manual.

import * as anthropic from './anthropic';
import * as gemini from './gemini';
import * as openai from './openai';
import { AiEssayInput, AiEssayScores, EssayAiProvider } from './shared';

export type { AiEssayInput, AiEssayScores, EssayAiProvider } from './shared';

/** Ordem de detecção automática quando ESSAY_AI_PROVIDER não está definido. */
const DETECTION_ORDER: EssayAiProvider[] = [
  'anthropic',
  'openai',
  'gemini',
  'openai-compatible',
];

function isProviderConfigured(provider: EssayAiProvider): boolean {
  switch (provider) {
    case 'anthropic':
      return anthropic.isConfigured();
    case 'openai':
      return openai.isConfigured();
    case 'openai-compatible':
      return openai.isCompatibleConfigured();
    case 'gemini':
      return gemini.isConfigured();
  }
}

/**
 * Resolve o provedor ativo. Respeita ESSAY_AI_PROVIDER se ele estiver
 * configurado; caso contrário, faz a detecção automática. Retorna null quando
 * nenhum provedor utilizável está configurado.
 */
export function activeEssayAiProvider(): EssayAiProvider | null {
  const explicit = process.env.ESSAY_AI_PROVIDER as EssayAiProvider | undefined;
  if (explicit) {
    return isProviderConfigured(explicit) ? explicit : null;
  }
  return DETECTION_ORDER.find(isProviderConfigured) ?? null;
}

/** Indica se a correção por IA está configurada (há algum provedor utilizável). */
export function isAiEssayConfigured(): boolean {
  return activeEssayAiProvider() !== null;
}

/**
 * Corrige uma redação com o provedor ativo e devolve as notas por competência +
 * feedback. Lança se nenhum provedor estiver configurado (o chamador trata como 503).
 */
export function gradeEssayWithAi(input: AiEssayInput): Promise<AiEssayScores> {
  const provider = activeEssayAiProvider();
  if (!provider) {
    throw new Error('Nenhum provedor de IA de redação configurado');
  }
  switch (provider) {
    case 'anthropic':
      return anthropic.grade(input);
    case 'openai':
      return openai.grade(input);
    case 'openai-compatible':
      return openai.gradeCompatible(input);
    case 'gemini':
      return gemini.grade(input);
  }
}
