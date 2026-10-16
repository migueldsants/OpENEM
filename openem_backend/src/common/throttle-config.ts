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

export function throttleConfigFromEnv(env: {
  THROTTLE_TTL_MS?: string;
  THROTTLE_LIMIT?: string;
}): ThrottleConfig {
  const positivo = (raw: string | undefined, padrao: number) => {
    const n = Number(raw);
    return raw?.trim() && Number.isInteger(n) && n > 0 ? n : padrao;
  };
  return {
    ttl: positivo(env.THROTTLE_TTL_MS, THROTTLE_DEFAULTS.ttl),
    limit: positivo(env.THROTTLE_LIMIT, THROTTLE_DEFAULTS.limit),
  };
}
