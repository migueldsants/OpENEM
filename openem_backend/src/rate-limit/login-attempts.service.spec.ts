import { MemoryCacheStore } from '../cache/cache-store';
import { loginKeys } from '../common/rate-limit';
import {
  LoginAttemptsService,
  TooManyAttemptsException,
} from './login-attempts.service';

const MIN = 60 * 1000;

function setup() {
  let t = 0;
  const store = new MemoryCacheStore(() => t);
  return {
    store,
    service: new LoginAttemptsService(store, 'rl'),
    avanca: (ms: number) => {
      t += ms;
    },
  };
}

async function erra(service: LoginAttemptsService, email: string, n: number) {
  for (let i = 0; i < n; i++) {
    await service.recordFailure(email).catch(() => undefined);
  }
}

describe('LoginAttemptsService', () => {
  it('quatro falhas passam; a quinta bloqueia por 15 min', async () => {
    const { service } = setup();
    for (let i = 0; i < 4; i++) {
      await expect(service.recordFailure('a@b.com')).resolves.toBeUndefined();
    }
    const err: unknown = await service
      .recordFailure('a@b.com')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TooManyAttemptsException);
    expect((err as TooManyAttemptsException).retryAfterSec).toBe(15 * 60);
    expect((err as TooManyAttemptsException).getStatus()).toBe(429);
  });

  it('bloqueada, recusa com o tempo que falta', async () => {
    const { service, avanca } = setup();
    await erra(service, 'a@b.com', 5);
    avanca(10 * MIN);
    const err: unknown = await service
      .assertAllowed('a@b.com')
      .catch((e: unknown) => e);
    expect((err as TooManyAttemptsException).retryAfterSec).toBe(5 * 60);
  });

  it('vencido o bloqueio, libera', async () => {
    const { service, avanca } = setup();
    await erra(service, 'a@b.com', 5);
    avanca(15 * MIN);
    await expect(service.assertAllowed('a@b.com')).resolves.toBeUndefined();
  });

  it('o segundo bloqueio do dia dura o dobro', async () => {
    const { service, avanca } = setup();
    await erra(service, 'a@b.com', 5);
    avanca(15 * MIN);
    await erra(service, 'a@b.com', 4);
    const err: unknown = await service
      .recordFailure('a@b.com')
      .catch((e: unknown) => e);
    expect((err as TooManyAttemptsException).retryAfterSec).toBe(30 * 60);
  });

  it('falhas antigas saem da janela de 15 min', async () => {
    const { service, avanca } = setup();
    await erra(service, 'a@b.com', 4);
    avanca(15 * MIN);
    await expect(service.recordFailure('a@b.com')).resolves.toBeUndefined();
  });

  it('sucesso zera as falhas', async () => {
    const { service, store } = setup();
    await erra(service, 'a@b.com', 4);
    await service.recordSuccess('a@b.com');
    await expect(
      store.get(loginKeys('rl', 'a@b.com').failures),
    ).resolves.toBeNull();
  });

  it('cada conta tem as próprias falhas', async () => {
    const { service } = setup();
    await erra(service, 'a@b.com', 5);
    await expect(service.assertAllowed('c@d.com')).resolves.toBeUndefined();
  });
});
