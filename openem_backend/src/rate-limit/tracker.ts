import type { JwtService } from '@nestjs/jwt';
import type { JwtPayload } from '../auth/jwt.strategy';
import { bearerToken, trackerFor } from '../common/rate-limit';

/** O que o tracker lê do pedido do Express. */
export interface TrackedRequest {
  headers?: { authorization?: string | string[] };
  ip?: string;
}

/**
 * Tracker do throttler: o aluno quando o pedido traz um JWT válido, o IP
 * quando não traz. O ThrottlerGuard é global e roda antes do JwtAuthGuard dos
 * controllers, então `req.user` ainda não existe: o token é conferido aqui.
 * Token inválido, vencido ou forjado conta como IP — senão bastaria inventar
 * um `sub` por pedido para nunca ser limitado.
 */
export function makeTracker(jwt: Pick<JwtService, 'verifyAsync'>) {
  return async (req: TrackedRequest): Promise<string> => {
    const token = bearerToken(req.headers?.authorization);
    if (token) {
      try {
        const payload = await jwt.verifyAsync<JwtPayload>(token);
        if (typeof payload?.sub === 'string' && payload.sub) {
          return trackerFor({ userId: payload.sub });
        }
      } catch {
        // cai no IP
      }
    }
    return trackerFor({ ip: req.ip });
  };
}
