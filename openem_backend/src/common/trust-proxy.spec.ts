import { parseTrustProxy } from './trust-proxy';

describe('parseTrustProxy', () => {
  it('ausente ou vazio não mexe na configuração do Express', () => {
    expect(parseTrustProxy(undefined)).toBeUndefined();
    expect(parseTrustProxy('')).toBeUndefined();
    expect(parseTrustProxy('   ')).toBeUndefined();
  });

  it('número vira a quantidade de proxies confiáveis', () => {
    expect(parseTrustProxy('1')).toBe(1);
    expect(parseTrustProxy(' 2 ')).toBe(2);
    expect(parseTrustProxy('0')).toBe(0);
  });

  it('false desliga explicitamente, sem diferenciar maiúsculas', () => {
    expect(parseTrustProxy('false')).toBe(false);
    expect(parseTrustProxy('FALSE')).toBe(false);
  });

  it('recusa true, que deixaria o cliente forjar o próprio IP', () => {
    expect(() => parseTrustProxy('true')).toThrow(/TRUST_PROXY=1/);
    expect(() => parseTrustProxy('True')).toThrow(/cliente/);
  });

  it('lista de endereços passa adiante para o Express, sem espaços nas pontas', () => {
    expect(parseTrustProxy(' loopback, 10.0.0.0/8 ')).toBe(
      'loopback, 10.0.0.0/8',
    );
  });

  it('número misturado com texto não vira número', () => {
    expect(parseTrustProxy('1a')).toBe('1a');
  });
});
