/* eslint-disable @typescript-eslint/require-await -- fetch falsos */
import { generateKeyPairSync } from 'node:crypto';
import { GoogleLoginError } from '../common/google-oidc';
import {
  GoogleOidcClient,
  JWKS_MIN_REFRESH_MS,
  JWKS_TTL_MS,
} from './google-oidc.client';
import { fakeGoogle } from './testing';

describe('GoogleOidcClient', () => {
  it('troca o código pelo ID token mandando o corpo como formulário', async () => {
    const google = fakeGoogle();
    google.nextClaims = { sub: 'u1' };
    const client = new GoogleOidcClient(google.fetch);
    const idToken = await client.exchangeCode(
      new URLSearchParams({ code: 'c1', code_verifier: 'v' }),
    );
    expect(google.tokenRequests[0].get('code')).toBe('c1');
    expect(await client.verifiedClaims(idToken)).toEqual({ sub: 'u1' });
  });

  it('troca recusada pelo Google vira falha', async () => {
    const google = fakeGoogle();
    const client = new GoogleOidcClient(google.fetch);
    await expect(
      client.exchangeCode(new URLSearchParams({ code: 'c1' })),
    ).rejects.toThrow(/troca do código recusada \(400: invalid_grant\)/);
  });

  it('rede fora do ar vira falha', async () => {
    const client = new GoogleOidcClient((() =>
      Promise.reject(new TypeError('fetch failed'))) as typeof fetch);
    await expect(
      client.exchangeCode(new URLSearchParams()),
    ).rejects.toBeInstanceOf(GoogleLoginError);
    await expect(
      client.verifiedClaims(fakeGoogle().signIdToken({})),
    ).rejects.toThrow(/chaves do Google fora do alcance/);
  });

  it('resposta sem id_token ou JWKS ruim viram falha', async () => {
    const semToken = new GoogleOidcClient((async () =>
      Response.json({ access_token: 'x' })) as typeof fetch);
    await expect(semToken.exchangeCode(new URLSearchParams())).rejects.toThrow(
      /recusada \(200\)/,
    );

    const token = fakeGoogle().signIdToken({ sub: 'u1' });
    const erro500 = new GoogleOidcClient(
      (async () => new Response('x', { status: 500 })) as typeof fetch,
    );
    await expect(erro500.verifiedClaims(token)).rejects.toThrow(
      /chaves do Google: 500/,
    );
    const vazio = new GoogleOidcClient((async () =>
      Response.json({ keys: [] })) as typeof fetch);
    await expect(vazio.verifiedClaims(token)).rejects.toThrow(
      /não mandou chaves/,
    );
  });

  it('recusa token sem kid, de chave desconhecida ou com assinatura falsa', async () => {
    const google = fakeGoogle();
    const client = new GoogleOidcClient(google.fetch);
    await expect(client.verifiedClaims('nao.e.jwt')).rejects.toThrow(/sem kid/);
    await expect(
      client.verifiedClaims(google.signIdToken({}, { kid: 'outra' })),
    ).rejects.toThrow(/assinatura do ID token inválida/);
    const outra = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    }).privateKey;
    await expect(
      client.verifiedClaims(google.signIdToken({}, { key: outra })),
    ).rejects.toThrow(/assinatura do ID token inválida/);
  });

  it('guarda as chaves por uma hora e busca de novo quando aparece kid novo', async () => {
    const google = fakeGoogle();
    const client = new GoogleOidcClient(google.fetch);
    let agora = 1_000_000;
    client.now = () => agora;
    const token = google.signIdToken({ sub: 'u1' });

    await client.verifiedClaims(token);
    await client.verifiedClaims(token);
    expect(google.jwksRequests).toBe(1);

    // Kid desconhecido logo depois: não bate no Google de novo.
    await expect(
      client.verifiedClaims(google.signIdToken({}, { kid: 'nova' })),
    ).rejects.toBeInstanceOf(GoogleLoginError);
    expect(google.jwksRequests).toBe(1);

    // O Google girou a chave: passado um minuto, busca de novo e acha.
    agora += JWKS_MIN_REFRESH_MS;
    google.kid = 'nova';
    await expect(
      client.verifiedClaims(google.signIdToken({ sub: 'u2' })),
    ).resolves.toEqual({ sub: 'u2' });
    expect(google.jwksRequests).toBe(2);

    // Venceu a hora: busca de novo mesmo com o kid conhecido.
    agora += JWKS_TTL_MS;
    await client.verifiedClaims(google.signIdToken({ sub: 'u3' }));
    expect(google.jwksRequests).toBe(3);
  });
});
