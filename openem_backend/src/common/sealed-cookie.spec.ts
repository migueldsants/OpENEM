import { openSealedJson, readCookie, sealJson } from './sealed-cookie';

const secret = 'segredo-de-teste-bem-comprido';
const base = { secret, purpose: 'google-oidc' };

describe('sealJson / openSealedJson', () => {
  it('ida e volta, sem o conteúdo legível no valor', () => {
    const valor = sealJson(
      { state: 'abc', verifier: 'segredo-pkce' },
      {
        ...base,
        nowMs: 1000,
        ttlMs: 60_000,
      },
    );
    expect(valor).toMatch(/^v1\.[A-Za-z0-9_-]+$/);
    expect(Buffer.from(valor.slice(3), 'base64url').toString()).not.toContain(
      'segredo-pkce',
    );
    expect(openSealedJson(valor, { ...base, nowMs: 2000 })).toEqual({
      state: 'abc',
      verifier: 'segredo-pkce',
    });
  });

  it('cada selo é diferente (IV aleatório)', () => {
    const a = sealJson({ x: 1 }, { ...base, nowMs: 0, ttlMs: 1000 });
    const b = sealJson({ x: 1 }, { ...base, nowMs: 0, ttlMs: 1000 });
    expect(a).not.toBe(b);
  });

  it('vencido não abre', () => {
    const valor = sealJson({ x: 1 }, { ...base, nowMs: 0, ttlMs: 1000 });
    expect(openSealedJson(valor, { ...base, nowMs: 999 })).toEqual({ x: 1 });
    expect(openSealedJson(valor, { ...base, nowMs: 1000 })).toBeNull();
  });

  it('mexido, de outra finalidade ou de outro segredo não abre', () => {
    const valor = sealJson({ x: 1 }, { ...base, nowMs: 0, ttlMs: 1000 });
    const bytes = Buffer.from(valor.slice(3), 'base64url');
    bytes[bytes.length - 1] ^= 1;
    const mexido = `v1.${bytes.toString('base64url')}`;
    expect(openSealedJson(mexido, { ...base, nowMs: 0 })).toBeNull();
    expect(
      openSealedJson(valor, { ...base, purpose: 'outra', nowMs: 0 }),
    ).toBeNull();
    expect(
      openSealedJson(valor, {
        ...base,
        secret: 'outro-segredo-comprido',
        nowMs: 0,
      }),
    ).toBeNull();
  });

  it.each([null, undefined, '', 'v2.abc', 'v1.', 'v1.curto', 'qualquer'])(
    'lixo (%p) não abre',
    (valor) => {
      expect(openSealedJson(valor, { ...base, nowMs: 0 })).toBeNull();
    },
  );
});

describe('readCookie', () => {
  it('acha o cookie pelo nome', () => {
    expect(readCookie('a=1; openem_google=v1.xyz; b=2', 'openem_google')).toBe(
      'v1.xyz',
    );
    expect(readCookie('openem_google=v1.xyz', 'openem_google')).toBe('v1.xyz');
  });

  it('decodifica o valor e aceita cabeçalho repetido', () => {
    expect(readCookie('x=a%20b', 'x')).toBe('a b');
    expect(readCookie(['a=1', 'x=2'], 'x')).toBe('2');
    expect(readCookie('x=%E0%A4%A', 'x')).toBe('%E0%A4%A');
  });

  it('null quando não há', () => {
    expect(readCookie(undefined, 'x')).toBeNull();
    expect(readCookie('', 'x')).toBeNull();
    expect(readCookie('xy=1; semvalor', 'x')).toBeNull();
  });
});
