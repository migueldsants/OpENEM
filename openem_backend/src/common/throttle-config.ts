/**
 * Limite padrão do rate limiting, lido de THROTTLE_TTL_MS e THROTTLE_LIMIT.
 *
 * Variável de ambiente chega como texto, e o throttler soma o TTL ao relógio:
 * `Date.now() + "60000"` vira concatenação, e o bloqueio passava a expirar
 * daqui a milhões de anos (só reiniciando o processo). Por isso o valor vira
 * número aqui, e valor ausente ou inválido cai no padrão.
 */

export interface ThrottleConfig {
  ttl: number;
  limit: number;
}

export const THROTTLE_DEFAULTS: ThrottleConfig = { ttl: 60_000, limit: 100 };

/** Inteiro positivo do ambiente, ou o padrão. */
function positivo(raw: string | undefined, padrao: number): number {
  const n = Number(raw);
  return raw?.trim() && Number.isInteger(n) && n > 0 ? n : padrao;
}

export function throttleConfigFromEnv(env: {
  THROTTLE_TTL_MS?: string;
  THROTTLE_LIMIT?: string;
}): ThrottleConfig {
  return {
    ttl: positivo(env.THROTTLE_TTL_MS, THROTTLE_DEFAULTS.ttl),
    limit: positivo(env.THROTTLE_LIMIT, THROTTLE_DEFAULTS.limit),
  };
}

/**
 * Rajada curta (issue #87): 20 pedidos por segundo, por rota e por aluno (ou
 * IP), além do limite por minuto. Segura um cliente em laço sem atrapalhar
 * quem clica rápido.
 */
export const BURST_DEFAULTS: ThrottleConfig = { ttl: 1000, limit: 20 };

export function burstConfigFromEnv(env: {
  THROTTLE_BURST_TTL_MS?: string;
  THROTTLE_BURST_LIMIT?: string;
}): ThrottleConfig {
  return {
    ttl: positivo(env.THROTTLE_BURST_TTL_MS, BURST_DEFAULTS.ttl),
    limit: positivo(env.THROTTLE_BURST_LIMIT, BURST_DEFAULTS.limit),
  };
}
