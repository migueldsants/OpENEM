import { ConfigService } from '@nestjs/config';
import { resolveJwtSecret } from './jwt-secret';

function makeConfig(values: Record<string, string | undefined>) {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe('resolveJwtSecret', () => {
  it('retorna o segredo configurado quando forte', () => {
    const config = makeConfig({ JWT_SECRET: 'um-segredo-bem-longo-e-forte' });
    expect(resolveJwtSecret(config)).toBe('um-segredo-bem-longo-e-forte');
  });

  it('usa o fallback de dev quando ausente fora de produção', () => {
    const config = makeConfig({ NODE_ENV: 'development' });
    expect(resolveJwtSecret(config)).toBe('dev-insecure-secret');
  });

  it('usa o fallback de dev quando o segredo é curto fora de produção', () => {
    const config = makeConfig({ NODE_ENV: undefined, JWT_SECRET: 'curto' });
    expect(resolveJwtSecret(config)).toBe('dev-insecure-secret');
  });

  it('falha rápido em produção sem JWT_SECRET', () => {
    const config = makeConfig({ NODE_ENV: 'production' });
    expect(() => resolveJwtSecret(config)).toThrow(/JWT_SECRET/);
  });

  it('falha rápido em produção com segredo curto', () => {
    const config = makeConfig({
      NODE_ENV: 'production',
      JWT_SECRET: 'curto-demais',
    });
    expect(() => resolveJwtSecret(config)).toThrow(/JWT_SECRET/);
  });

  it('falha rápido em teste sem JWT_SECRET', () => {
    const config = makeConfig({ NODE_ENV: 'test' });
    expect(() => resolveJwtSecret(config)).toThrow(/JWT_SECRET/);
  });
});
