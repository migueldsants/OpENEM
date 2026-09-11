/**
 * Camada de IA do OpENEM: seleção de provedor + uma chamada que devolve JSON.
 *
 * Nasceu dentro da correção de redação (Fase 3) e foi extraída quando as
 * questões oficiais do ENEM passaram a precisar da mesma infraestrutura para
 * gerar comentário e classificar assunto. Aqui não há nada específico de um
 * caso de uso: prompts, schemas e validação ficam com quem chama.
 *
 * O provedor é escolhido por AI_PROVIDER (ou ESSAY_AI_PROVIDER no escopo da
 * redação, que já está publicado no docker-compose). Sem variável, detecta o
 * primeiro provedor configurado. Sem nenhum, os recursos de IA ficam
 * indisponíveis e o app segue funcionando sem eles.
 */

import * as anthropic from './providers/anthropic';
import * as gemini from './providers/gemini';
import * as openai from './providers/openai';
import { AiProvider, JsonCompletionRequest } from './types';

export type { AiProvider, JsonCompletionRequest } from './types';

/** Ordem de detecção automática quando não há variável de ambiente. */
const DETECTION_ORDER: AiProvider[] = [
  'anthropic',
  'openai',
  'gemini',
  'openai-compatible',
];

export function isProviderConfigured(provider: AiProvider): boolean {
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
 * Resolve o provedor ativo. `scope: 'essay'` respeita ESSAY_AI_PROVIDER, que já
 * está em uso — trocar a variável quebraria quem já configurou o compose.
 * Devolve null quando não há provedor utilizável.
 */
export function activeAiProvider(scope?: 'essay'): AiProvider | null {
  const explicit = (
    scope === 'essay'
      ? (process.env.ESSAY_AI_PROVIDER ?? process.env.AI_PROVIDER)
      : process.env.AI_PROVIDER
  ) as AiProvider | undefined;
  if (explicit) {
    return isProviderConfigured(explicit) ? explicit : null;
  }
  return DETECTION_ORDER.find(isProviderConfigured) ?? null;
}

/** Indica se há algum provedor utilizável configurado. */
export function isAiConfigured(scope?: 'essay'): boolean {
  return activeAiProvider(scope) !== null;
}

/**
 * Chama o provedor ativo e devolve o TEXTO cru da resposta (espera-se JSON
 * conforme `req.schema`). Lança se não houver provedor configurado — quem chama
 * deve checar `isAiConfigured()` antes e decidir o fallback.
 */
export function completeJson(
  req: JsonCompletionRequest,
  scope?: 'essay',
): Promise<string> {
  const provider = activeAiProvider(scope);
  if (!provider) {
    throw new Error('Nenhum provedor de IA configurado');
  }
  switch (provider) {
    case 'anthropic':
      return anthropic.completeJson(req);
    case 'openai':
      return openai.completeJson(req);
    case 'openai-compatible':
      return openai.completeJsonCompatible(req);
    case 'gemini':
      return gemini.completeJson(req);
  }
}
