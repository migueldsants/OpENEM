import {
  checkGoogleClaims,
  GOOGLE_AUTH_URL,
  googleAuthorizationUrl,
  GoogleLoginError,
  pkceChallenge,
  tokenRequestBody,
} from './google-oidc';

const clientId = 'cliente.apps.googleusercontent.com';
const nowSec = 1_800_000_000;

function claims(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    iss: 'https://accounts.google.com',
    aud: clientId,
    sub: '1234567890',
    email: 'aluna@gmail.com',
    email_verified: true,
    nonce: 'nonce-1',
    iat: nowSec - 10,
    exp: nowSec + 3600,
    ...over,
  };
}

function erroDe(fn: () => unknown): GoogleLoginError {
  try {
    fn();
  } catch (err) {
    if (err instanceof GoogleLoginError) return err;
    throw err;
  }
  throw new Error('não lançou');
}

const check = (c: Record<string, unknown>) =>
  checkGoogleClaims(c, { clientId, nonce: 'nonce-1', nowSec });

describe('pkceChallenge', () => {
  it('segue o exemplo da RFC 7636 (apêndice B)', () => {
    expect(pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });
});

describe('googleAuthorizationUrl', () => {
  it('pede code com PKCE S256, state, nonce e só openid email', () => {
    const url = new URL(
      googleAuthorizationUrl({
        clientId,
        redirectUri: 'https://o.ex/api/v1/auth/google/callback',
        flow: { state: 's1', nonce: 'n1', verifier: 'v1' },
      }),
    );
    expect(`${url.origin}${url.pathname}`).toBe(GOOGLE_AUTH_URL);
    const p = url.searchParams;
    expect(p.get('client_id')).toBe(clientId);
    expect(p.get('redirect_uri')).toBe(
      'https://o.ex/api/v1/auth/google/callback',
    );
    expect(p.get('response_type')).toBe('code');
    expect(p.get('scope')).toBe('openid email');
    expect(p.get('state')).toBe('s1');
    expect(p.get('nonce')).toBe('n1');
    expect(p.get('code_challenge')).toBe(pkceChallenge('v1'));
    expect(p.get('code_challenge_method')).toBe('S256');
    expect(p.get('prompt')).toBe('select_account');
    // O segredo do PKCE nunca vai na URL.
    expect(url.toString()).not.toContain('v1&');
  });
});

describe('tokenRequestBody', () => {
  it('manda o código, o verificador e o segredo do cliente', () => {
    const body = tokenRequestBody({
      code: 'c',
      verifier: 'v',
      clientId,
      clientSecret: 'segredo',
      redirectUri: 'https://o.ex/cb',
    });
    expect(Object.fromEntries(body)).toEqual({
      grant_type: 'authorization_code',
      code: 'c',
      code_verifier: 'v',
      client_id: clientId,
      client_secret: 'segredo',
      redirect_uri: 'https://o.ex/cb',
    });
  });
});

describe('checkGoogleClaims', () => {
  it('devolve sub e e-mail de um token válido', () => {
    expect(check(claims())).toEqual({
      sub: '1234567890',
      email: 'aluna@gmail.com',
    });
  });

  it('aceita o emissor sem esquema e email_verified em texto', () => {
    expect(
      check(claims({ iss: 'accounts.google.com', email_verified: 'true' })).sub,
    ).toBe('1234567890');
  });

  it('aceita aud em lista com o azp certo', () => {
    expect(check(claims({ aud: [clientId] })).sub).toBe('1234567890');
    expect(check(claims({ aud: [clientId, 'outro'], azp: clientId })).sub).toBe(
      '1234567890',
    );
  });

  it.each([
    ['emissor estranho', { iss: 'https://evil.example' }],
    ['outro cliente', { aud: 'outro-cliente' }],
    ['lista sem o cliente', { aud: ['outro'] }],
    ['lista sem azp', { aud: [clientId, 'outro'] }],
    ['aud ausente', { aud: undefined }],
    ['vencido', { exp: nowSec - 120 }],
    ['sem exp', { exp: undefined }],
    ['emitido no futuro', { iat: nowSec + 600 }],
    ['sem sub', { sub: '' }],
    ['sem e-mail', { email: undefined }],
    ['e-mail sem arroba', { email: 'nada' }],
  ])('recusa: %s', (_nome, over) => {
    expect(erroDe(() => check(claims(over))).code).toBe('falha');
  });

  it('tolera relógio um pouco atrasado', () => {
    expect(check(claims({ exp: nowSec - 30 })).sub).toBe('1234567890');
  });

  it('nonce diferente ou ausente é problema de sessão', () => {
    expect(erroDe(() => check(claims({ nonce: 'outro' }))).code).toBe('sessao');
    expect(erroDe(() => check(claims({ nonce: undefined }))).code).toBe(
      'sessao',
    );
  });

  it('e-mail não confirmado pelo Google não entra', () => {
    expect(erroDe(() => check(claims({ email_verified: false }))).code).toBe(
      'email',
    );
    expect(
      erroDe(() => check(claims({ email_verified: undefined }))).code,
    ).toBe('email');
  });
});
