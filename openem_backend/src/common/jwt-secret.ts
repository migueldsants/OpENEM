import { ConfigService } from '@nestjs/config';

/**
 * Resolve o segredo JWT de forma segura:
 * - falha rápido (throw) quando ausente em produção;
 * - permite o fallback de desenvolvimento apenas em NODE_ENV !== 'production',
 *   cobrindo `npm run start:dev` sem .env.
 * Rejeita também segredos curtos demais (< 16 chars), que tornam o token
 * trivialmente forjável.
 */
export function resolveJwtSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET');
  if (!secret || secret.length < 16) {
    if (
      config.get<string>('NODE_ENV') === 'production' ||
      config.get<string>('NODE_ENV') === 'test'
    ) {
      throw new Error(
        'JWT_SECRET ausente ou curto demais: defina um segredo forte (ex.: openssl rand -hex 32)',
      );
    }
    return 'dev-insecure-secret';
  }
  return secret;
}
