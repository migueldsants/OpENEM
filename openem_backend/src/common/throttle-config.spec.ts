import { THROTTLE_DEFAULTS, throttleConfigFromEnv } from './throttle-config';

describe('throttleConfigFromEnv', () => {
  it('sem variáveis, usa 100 requisições por minuto', () => {
    expect(throttleConfigFromEnv({})).toEqual({ ttl: 60_000, limit: 100 });
  });

  it('converte o texto do ambiente em número', () => {
    const cfg = throttleConfigFromEnv({
      THROTTLE_TTL_MS: '30000',
      THROTTLE_LIMIT: '20',
    });
    expect(cfg).toEqual({ ttl: 30_000, limit: 20 });
    // O bug: string somada ao relógio vira concatenação.
    expect(typeof cfg.ttl).toBe('number');
    expect(typeof cfg.limit).toBe('number');
  });

  it('valor inválido, zero ou negativo cai no padrão', () => {
    for (const raw of ['', '  ', 'abc', '0', '-5', '1.5', '60s']) {
      expect(
        throttleConfigFromEnv({ THROTTLE_TTL_MS: raw, THROTTLE_LIMIT: raw }),
      ).toEqual(THROTTLE_DEFAULTS);
    }
  });
});
