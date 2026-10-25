import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { CacheStore } from '../cache/cache-store';
import {
  LOGIN_BLOCK_MAX_MS,
  LOGIN_FAILURE_LIMIT,
  LOGIN_FAILURE_WINDOW_MS,
  LOGIN_STRIKES_TTL_MS,
  loginBlockMs,
  loginKeys,
  rateLimitMessage,
  retryAfterSeconds,
} from '../common/rate-limit';
import { RATE_PREFIX, RATE_STORE } from './rate-limit.tokens';

/** 429 que carrega a espera, para o controller pôr no `Retry-After`. */
export class TooManyAttemptsException extends HttpException {
  constructor(readonly retryAfterSec: number) {
    super(rateLimitMessage(retryAfterSec), HttpStatus.TOO_MANY_REQUESTS);
  }
}

/**
 * Limite de senhas erradas por conta (issue #87). O limite por IP não pega
 * quem ataca uma conta trocando de IP; este conta as falhas do e-mail, venha
 * de onde vier: 5 em 15 minutos bloqueiam a conta, e cada novo bloqueio no
 * mesmo dia dobra o anterior (15 min, 30 min, 1 h... até 24 h). O login certo
 * zera as falhas.
 *
 * Vale igual para e-mail com e sem conta, e o bloqueio é checado antes da
 * senha: a resposta não revela quais e-mails existem.
 */
@Injectable()
export class LoginAttemptsService {
  constructor(
    @Inject(RATE_STORE) private readonly store: CacheStore,
    @Inject(RATE_PREFIX) private readonly prefix: string,
  ) {}

  /** Lança 429 se a conta está bloqueada. */
  async assertAllowed(email: string): Promise<void> {
    const restante = await this.store.pttl(loginKeys(this.prefix, email).block);
    if (restante !== null && restante !== 0) {
      // -1 (sem prazo) não deveria existir; trata como o bloqueio máximo.
      throw new TooManyAttemptsException(
        retryAfterSeconds(restante < 0 ? LOGIN_BLOCK_MAX_MS : restante),
      );
    }
  }

  /** Conta uma senha errada; na quinta, bloqueia e lança o 429. */
  async recordFailure(email: string): Promise<void> {
    const k = loginKeys(this.prefix, email);
    const falhas = await this.store.incrWithTtl(
      k.failures,
      LOGIN_FAILURE_WINDOW_MS,
    );
    if (falhas < LOGIN_FAILURE_LIMIT) return;

    const bloqueio = await this.store.incrWithTtl(
      k.strikes,
      LOGIN_STRIKES_TTL_MS,
    );
    const ms = loginBlockMs(bloqueio);
    await this.store.set(k.block, '1', ms);
    await this.store.del(k.failures);
    throw new TooManyAttemptsException(retryAfterSeconds(ms));
  }

  /** Login certo: as falhas anteriores não contam mais. */
  async recordSuccess(email: string): Promise<void> {
    await this.store.del(loginKeys(this.prefix, email).failures);
  }

  /**
   * Senha redefinida pelo link do e-mail: o dono provou quem é, então as
   * falhas e o bloqueio em curso saem. O histórico de bloqueios fica, para o
   * próximo ainda dobrar.
   */
  async clear(email: string): Promise<void> {
    const k = loginKeys(this.prefix, email);
    await this.store.del(k.failures);
    await this.store.del(k.block);
  }
}
