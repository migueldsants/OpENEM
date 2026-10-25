import {
  authFeatures,
  DEV_PUBLIC_URL,
  googleRedirectUri,
  googleReturnUrl,
  passwordResetLink,
  resolvePublicUrl,
} from './auth-config';

const smtp = {
  SMTP_URL: 'smtps://user:senha@smtp.exemplo.com:465',
  MAIL_FROM: 'OpENEM <nao-responda@exemplo.com>',
};
const google = {
  GOOGLE_CLIENT_ID: 'id.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'segredo',
};

describe('resolvePublicUrl', () => {
  it('usa a SITE_URL sem a barra do fim', () => {
    expect(resolvePublicUrl({ SITE_URL: 'https://openem.exemplo/' })).toBe(
      'https://openem.exemplo',
    );
    expect(resolvePublicUrl({ SITE_URL: ' http://escola.local:8080 ' })).toBe(
      'http://escola.local:8080',
    );
  });

  it('aceita instalação num caminho', () => {
    expect(resolvePublicUrl({ SITE_URL: 'https://escola.br/openem//' })).toBe(
      'https://escola.br/openem',
    );
  });

  it('sem SITE_URL: endereço do Vite fora de produção, nada em produção', () => {
    expect(resolvePublicUrl({})).toBe(DEV_PUBLIC_URL);
    expect(resolvePublicUrl({ NODE_ENV: 'test' })).toBe(DEV_PUBLIC_URL);
    expect(resolvePublicUrl({ NODE_ENV: 'production' })).toBeNull();
    expect(
      resolvePublicUrl({ NODE_ENV: 'production', SITE_URL: '  ' }),
    ).toBeNull();
  });

  it('recusa endereço inválido, de outro esquema ou com consulta/credencial', () => {
    expect(resolvePublicUrl({ SITE_URL: 'openem.exemplo' })).toBeNull();
    expect(resolvePublicUrl({ SITE_URL: 'ftp://openem.exemplo' })).toBeNull();
    expect(resolvePublicUrl({ SITE_URL: 'javascript:alert(1)' })).toBeNull();
    expect(resolvePublicUrl({ SITE_URL: 'https://a.b/?x=1' })).toBeNull();
    expect(resolvePublicUrl({ SITE_URL: 'https://a.b/#x' })).toBeNull();
    expect(resolvePublicUrl({ SITE_URL: 'https://u:p@a.b' })).toBeNull();
  });
});

describe('authFeatures', () => {
  it('sem variáveis: tudo desligado e sem aviso', () => {
    expect(authFeatures({ NODE_ENV: 'production' })).toEqual({
      publicUrl: null,
      mail: null,
      google: null,
      warnings: [],
    });
  });

  it('liga SMTP e Google com as variáveis completas', () => {
    const f = authFeatures({
      NODE_ENV: 'production',
      SITE_URL: 'https://openem.exemplo',
      ...smtp,
      ...google,
    });
    expect(f.publicUrl).toBe('https://openem.exemplo');
    expect(f.mail).toEqual({ url: smtp.SMTP_URL, from: smtp.MAIL_FROM });
    expect(f.google).toEqual({
      clientId: google.GOOGLE_CLIENT_ID,
      clientSecret: 'segredo',
    });
    expect(f.warnings).toEqual([]);
  });

  it('em dev, sem SITE_URL, liga com o endereço do Vite', () => {
    const f = authFeatures({ ...smtp, ...google });
    expect(f.publicUrl).toBe(DEV_PUBLIC_URL);
    expect(f.mail).not.toBeNull();
    expect(f.google).not.toBeNull();
  });

  it('variável pela metade desliga o recurso e avisa', () => {
    const f = authFeatures({
      SMTP_URL: smtp.SMTP_URL,
      GOOGLE_CLIENT_ID: google.GOOGLE_CLIENT_ID,
    });
    expect(f.mail).toBeNull();
    expect(f.google).toBeNull();
    expect(f.warnings).toHaveLength(2);
    expect(f.warnings[0]).toMatch(/SMTP_URL e MAIL_FROM/);
    expect(f.warnings[1]).toMatch(/GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET/);
    expect(authFeatures({ MAIL_FROM: 'x@y.z' }).warnings[0]).toMatch(/juntas/);
  });

  it('SMTP_URL de outro esquema desliga a recuperação', () => {
    const f = authFeatures({ ...smtp, SMTP_URL: 'https://smtp.exemplo.com' });
    expect(f.mail).toBeNull();
    expect(f.warnings[0]).toMatch(/smtp:\/\//);
  });

  it('produção sem SITE_URL desliga os dois e explica', () => {
    const f = authFeatures({ NODE_ENV: 'production', ...smtp, ...google });
    expect(f.mail).toBeNull();
    expect(f.google).toBeNull();
    expect(f.warnings.join(' ')).toMatch(/SMTP_URL sem SITE_URL/);
    expect(f.warnings.join(' ')).toMatch(/GOOGLE_CLIENT_ID sem SITE_URL/);
  });

  it('SITE_URL inválida vira aviso', () => {
    const f = authFeatures({ NODE_ENV: 'production', SITE_URL: 'nada' });
    expect(f.publicUrl).toBeNull();
    expect(f.warnings[0]).toMatch(/SITE_URL inválida/);
  });
});

describe('links', () => {
  it('link do e-mail leva o token no fragmento', () => {
    expect(passwordResetLink('https://o.ex', 'abc_-1')).toBe(
      'https://o.ex/app/redefinir-senha#token=abc_-1',
    );
  });

  it('volta do Google pela API e de volta ao app', () => {
    expect(googleRedirectUri('https://o.ex')).toBe(
      'https://o.ex/api/v1/auth/google/callback',
    );
    expect(googleReturnUrl('https://o.ex', { code: 'c1' })).toBe(
      'https://o.ex/app/entrar/google#code=c1',
    );
    expect(googleReturnUrl('https://o.ex', { error: 'sessao' })).toBe(
      'https://o.ex/app/entrar/google#erro=sessao',
    );
  });
});
