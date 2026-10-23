// 429 do rate limiting (issue #87): o aluno lê quanto esperar, não "Erro 429".
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, HttpError } from './api';

function resposta429(headers: Record<string, string>) {
  return new Response(
    JSON.stringify({
      statusCode: 429,
      message: 'ThrottlerException: Too Many Requests',
    }),
    { status: 429, headers },
  );
}

describe('api — 429', () => {
  afterEach(() => vi.restoreAllMocks());

  it('mensagem em português com a espera do Retry-After', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      resposta429({ 'Retry-After': '42' }),
    );
    const err: unknown = await api
      .login('a@b.com', 'senha123456')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(429);
    expect((err as HttpError).retryAfterSec).toBe(42);
    expect((err as HttpError).message).toBe(
      'Muitas tentativas. Tente de novo em 42 s.',
    );
  });

  it('sem Retry-After, "em instantes"', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(resposta429({}));
    const err = (await api
      .login('a@b.com', 'senha123456')
      .catch((e: unknown) => e)) as HttpError;
    expect(err.retryAfterSec).toBeNull();
    expect(err.message).toBe('Muitas tentativas. Tente de novo em instantes.');
  });

  it('o PDF também traduz o 429', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      resposta429({ 'Retry-After': '900' }),
    );
    const err = (await api
      .formulasPdf({})
      .catch((e: unknown) => e)) as HttpError;
    expect(err.status).toBe(429);
    expect(err.message).toBe('Muitas tentativas. Tente de novo em 15 min.');
  });
});
