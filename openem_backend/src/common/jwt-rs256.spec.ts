import { createHmac, generateKeyPairSync } from 'node:crypto';
import { fakeGoogle } from '../auth/testing';
import { jwtHeader, rsaKeysFromJwks, verifyRs256 } from './jwt-rs256';

describe('jwt-rs256', () => {
  const google = fakeGoogle();
  let jwks: unknown;

  beforeAll(async () => {
    jwks = await (
      await google.fetch('https://www.googleapis.com/oauth2/v3/certs')
    ).json();
  });

  it('confere a assinatura com a chave do JWKS', () => {
    const chaves = rsaKeysFromJwks(jwks);
    const token = google.signIdToken({ sub: 'u1' });
    expect(jwtHeader(token)).toMatchObject({ alg: 'RS256', kid: google.kid });
    expect(verifyRs256(token, chaves.get(google.kid)!)).toEqual({ sub: 'u1' });
  });

  it('recusa token assinado por outra chave', () => {
    const outra = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    }).privateKey;
    const token = google.signIdToken({ sub: 'u1' }, { key: outra });
    expect(
      verifyRs256(token, rsaKeysFromJwks(jwks).get(google.kid)!),
    ).toBeNull();
  });

  it('recusa corpo trocado depois da assinatura', () => {
    const [h, , s] = google.signIdToken({ sub: 'u1' }).split('.');
    const corpo = Buffer.from(JSON.stringify({ sub: 'admin' })).toString(
      'base64url',
    );
    expect(
      verifyRs256(`${h}.${corpo}.${s}`, rsaKeysFromJwks(jwks).get(google.kid)!),
    ).toBeNull();
  });

  it('recusa alg none e HS256 com a chave pública como segredo', () => {
    const chave = rsaKeysFromJwks(jwks).get(google.kid)!;
    const h = (alg: string) =>
      Buffer.from(JSON.stringify({ alg, kid: google.kid })).toString(
        'base64url',
      );
    const corpo = Buffer.from(JSON.stringify({ sub: 'u1' })).toString(
      'base64url',
    );
    expect(verifyRs256(`${h('none')}.${corpo}.`, chave)).toBeNull();
    const pem = chave.export({ type: 'spki', format: 'pem' });
    const hs = createHmac('sha256', pem)
      .update(`${h('HS256')}.${corpo}`)
      .digest('base64url');
    expect(verifyRs256(`${h('HS256')}.${corpo}.${hs}`, chave)).toBeNull();
  });

  it('malformado não passa', () => {
    const chave = rsaKeysFromJwks(jwks).get(google.kid)!;
    expect(verifyRs256('a.b', chave)).toBeNull();
    expect(jwtHeader('a.b')).toBeNull();
    expect(jwtHeader('!!.b.c')).toBeNull();
    expect(
      jwtHeader(`${Buffer.from('[1]').toString('base64url')}.b.c`),
    ).toBeNull();
  });

  it('rsaKeysFromJwks ignora o que não é chave RSA de assinatura', () => {
    const base = (jwks as { keys: Record<string, unknown>[] }).keys[0];
    const chaves = rsaKeysFromJwks({
      keys: [
        base,
        { ...base, kid: 'cifra', use: 'enc' },
        { kty: 'EC', kid: 'ec' },
        { ...base, kid: undefined },
        { kty: 'RSA', kid: 'quebrada' },
        null,
      ],
    });
    expect([...chaves.keys()]).toEqual([google.kid]);
    expect(rsaKeysFromJwks(null).size).toBe(0);
    expect(rsaKeysFromJwks({ keys: 'x' }).size).toBe(0);
  });
});
