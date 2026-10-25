import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { resolveJwtSecret } from '../common/jwt-secret';
import { SessionsService } from './sessions.service';

export interface JwtPayload {
  sub: string;
  email: string;
  /** Versão de token do aluno na emissão; sem ela (token antigo), 0. */
  ver?: number;
}

export interface AuthenticatedUser {
  userId: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly sessions: SessionsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: resolveJwtSecret(config),
    });
  }

  /**
   * A assinatura e o prazo já foram conferidos; falta a sessão estar viva. A
   * versão muda quando o aluno troca ou redefine a senha ou sai de todos os
   * dispositivos, e some quando a conta é excluída.
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const atual = await this.sessions.currentVersion(payload.sub);
    if (atual === null || atual !== (payload.ver ?? 0)) {
      throw new UnauthorizedException('Sessão encerrada. Entre de novo.');
    }
    return { userId: payload.sub, email: payload.email };
  }
}
