import {
  hashToken,
  randomToken,
  resetEmailKey,
  safeEqual,
} from './auth-tokens';

describe('auth-tokens', () => {
  it('randomToken: 256 bits em base64url, diferente a cada chamada', () => {
    const a = randomToken();
    const b = randomToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
    expect(randomToken(48)).toHaveLength(64);
  });

  it('hashToken: SHA-256 em hex, estável', () => {
    expect(hashToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abd')).not.toBe(hashToken('abc'));
  });

  it('safeEqual compara o conteúdo, inclusive tamanhos diferentes', () => {
    expect(safeEqual('state-1', 'state-1')).toBe(true);
    expect(safeEqual('state-1', 'state-2')).toBe(false);
    expect(safeEqual('curto', 'mais comprido')).toBe(false);
    expect(safeEqual('', '')).toBe(true);
  });

  it('resetEmailKey fica sob o prefixo do rate limiting', () => {
    expect(resetEmailKey('openem:v1:rl', 'abc')).toBe('openem:v1:rl:reset:abc');
  });
});
