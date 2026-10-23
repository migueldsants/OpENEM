import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ThrottlerException,
  type ThrottlerLimitDetail,
} from '@nestjs/throttler';
import { AppThrottlerGuard } from './app-throttler.guard';

describe('AppThrottlerGuard', () => {
  function contexto() {
    const res = { header: jest.fn() };
    const ctx = {
      switchToHttp: () => ({ getResponse: () => res }),
    } as unknown as ExecutionContext;
    return { ctx, res };
  }

  const guard = new AppThrottlerGuard(
    { throttlers: [] },
    { increment: jest.fn() },
    new Reflector(),
  );

  /** Chama o método protegido e devolve o que ele lançou. */
  function lancar(
    ctx: ExecutionContext,
    detail: Partial<ThrottlerLimitDetail>,
  ): unknown {
    try {
      void (
        guard as unknown as {
          throwThrottlingException: (
            c: ExecutionContext,
            d: Partial<ThrottlerLimitDetail>,
          ) => Promise<void>;
        }
      ).throwThrottlingException(ctx, detail);
    } catch (e) {
      return e;
    }
    return undefined;
  }

  it('põe Retry-After padrão e a mensagem em português', () => {
    const { ctx, res } = contexto();
    const erro = lancar(ctx, { timeToBlockExpire: 42 });
    expect(res.header).toHaveBeenCalledWith('Retry-After', '42');
    expect(erro).toBeInstanceOf(ThrottlerException);
    expect((erro as ThrottlerException).message).toBe(
      'Muitas tentativas. Tente de novo em 42 s.',
    );
    expect((erro as ThrottlerException).getStatus()).toBe(429);
  });

  it('nunca manda Retry-After 0', () => {
    const { ctx, res } = contexto();
    lancar(ctx, { timeToBlockExpire: 0 });
    expect(res.header).toHaveBeenCalledWith('Retry-After', '1');
  });
});
