import { withinBases } from './study-resource-rules';

/**
 * Lógica pura do verificador de links do "Onde estudar"
 * (`scripts/verificar-recursos.ts`). O script só faz as requisições; o que
 * conta como link quebrado, desvio ou bloqueio de robô fica aqui, testado.
 */

export type CheckOutcome = 'ok' | 'falha' | 'inconclusivo';

export interface CheckResult {
  outcome: CheckOutcome;
  reason: string;
}

/** Máximo de redirecionamentos seguidos antes de desistir. */
export const MAX_REDIRECTS = 5;

/** A conferência vence em até tantos dias: o verificador avisa. */
export const EXPIRY_WARNING_DAYS = 30;

/**
 * Páginas de desafio anti-robô (Cloudflare e afins). Elas respondem 403/503
 * ou até 200 a um script, mas abrem normalmente no navegador: o resultado é
 * "inconclusivo", e uma pessoa confere o link à mão.
 */
const CHALLENGE =
  /just a moment|um momento…|attention required|cf-chl|cf_chl|challenge-platform|client challenge|checking your browser|verifica[cç][aã]o de seguran[cç]a/i;

/** Caminhos que indicam tela de login, cadastro ou pagamento. */
const GATE_PATH =
  /\/(login|signin|sign-in|sign_in|signup|sign-up|entrar|cadastro|cadastre-se|registro|register|checkout|assinar|assine|subscribe|pricing|planos|paywall)(\/|$|\?|\.)/i;

/** A página é um desafio anti-robô? */
export function isChallenge(body: string): boolean {
  return CHALLENGE.test(body.slice(0, 20_000));
}

/** O endereço leva a login, cadastro ou pagamento? */
export function isGatePath(url: string): boolean {
  try {
    return GATE_PATH.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

/** Classifica a resposta final (depois dos redirecionamentos). */
export function classifyResponse(status: number, body: string): CheckResult {
  if (status === 402)
    return { outcome: 'falha', reason: 'pede pagamento (402)' };
  if (status === 401) return { outcome: 'falha', reason: 'pede login (401)' };
  if (status === 404 || status === 410) {
    return { outcome: 'falha', reason: `página não existe (${status})` };
  }
  if (isChallenge(body)) {
    return {
      outcome: 'inconclusivo',
      reason: `proteção contra robôs (${status}); confira no navegador`,
    };
  }
  if (status === 403 || status === 429) {
    return {
      outcome: 'inconclusivo',
      reason: `o site recusou o script (${status}); confira no navegador`,
    };
  }
  if (status >= 200 && status < 300)
    return { outcome: 'ok', reason: `${status}` };
  return { outcome: 'falha', reason: `resposta ${status}` };
}

/**
 * O próximo passo de um redirecionamento: resolve o `Location` relativo e
 * recusa sair do site da instituição, cair em http ou numa tela de login.
 */
export function followRedirect(
  from: string,
  location: string | null,
  bases: readonly string[],
): { next: string } | CheckResult {
  if (!location)
    return { outcome: 'falha', reason: 'redirecionamento sem destino' };
  let next: string;
  try {
    next = new URL(location, from).href;
  } catch {
    return { outcome: 'falha', reason: `destino inválido: ${location}` };
  }
  if (!next.startsWith('https://')) {
    return {
      outcome: 'falha',
      reason: `redireciona para fora do https: ${next}`,
    };
  }
  if (!withinBases(next, bases)) {
    return {
      outcome: 'falha',
      reason: `redireciona para fora da instituição: ${next}`,
    };
  }
  if (isGatePath(next)) {
    return {
      outcome: 'falha',
      reason: `redireciona para login ou pagamento: ${next}`,
    };
  }
  return { next };
}
