import { ExecutionContext, Injectable } from '@nestjs/common';
import {
  ThrottlerException,
  ThrottlerGuard,
  type ThrottlerLimitDetail,
} from '@nestjs/throttler';
import type { Response } from 'express';
import { rateLimitMessage, retryAfterSeconds } from '../common/rate-limit';

/**
 * ThrottlerGuard com o 429 que o app entende: `Retry-After` padrão em todo
 * 429 (o throttler só o põe com esse nome no limite `default`; na rajada,
 * sairia `Retry-After-burst`) e a mensagem em português com a espera.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    const segundos = retryAfterSeconds(detail.timeToBlockExpire * 1000);
    context
      .switchToHttp()
      .getResponse<Response>()
      .header('Retry-After', String(segundos));
    throw new ThrottlerException(rateLimitMessage(segundos));
  }
}
