/**
 * Configuração dos recursos opcionais da conta: recuperação de senha por
 * e-mail (SMTP) e login com Google (OIDC). Os dois dependem de serviço de
 * fora, então só ligam com as variáveis definidas; sem elas o app segue só com
 * e-mail e senha.
 */

export interface AuthEnv {
  NODE_ENV?: string;
  SITE_URL?: string;
  SMTP_URL?: string;
  MAIL_FROM?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

export interface MailConfig {
  url: string;
  from: string;
}

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
}

export interface AuthFeatures {
  /** Endereço público da instalação, sem barra no fim. */
  publicUrl: string | null;
  /** SMTP para o link de redefinição (null = recurso desligado). */
  mail: MailConfig | null;
  /** Cliente OAuth do Google (null = botão escondido). */
  google: GoogleConfig | null;
  /** Variável definida pela metade ou inválida: vai para o log na subida. */
  warnings: string[];
}

/** Onde o app abre no `npm run dev` do frontend (o Vite repassa a /api). */
export const DEV_PUBLIC_URL = 'http://localhost:5173';

function texto(valor: string | undefined): string {
  return (valor ?? '').trim();
}

/**
 * Endereço público (`SITE_URL`). Os links do e-mail e o retorno do Google
 * saem daqui, nunca do cabeçalho Host do pedido: quem forja o Host faria o
 * e-mail de redefinição apontar para o site dele. Fora de produção, sem a
 * variável, vale o endereço do Vite.
 */
export function resolvePublicUrl(env: AuthEnv): string | null {
  const bruto = texto(env.SITE_URL);
  if (!bruto) return env.NODE_ENV === 'production' ? null : DEV_PUBLIC_URL;
  let url: URL;
  try {
    url = new URL(bruto);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.search || url.hash || url.username || url.password) return null;
  return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
}

/** Lê as variáveis e diz o que ficou ligado (e por que não). */
export function authFeatures(env: AuthEnv): AuthFeatures {
  const warnings: string[] = [];
  const publicUrl = resolvePublicUrl(env);
  if (texto(env.SITE_URL) && !publicUrl) {
    warnings.push(
      'SITE_URL inválida (use algo como https://openem.exemplo, sem caminho de consulta)',
    );
  }

  let mail: MailConfig | null = null;
  const smtp = texto(env.SMTP_URL);
  const from = texto(env.MAIL_FROM);
  if (smtp || from) {
    if (!smtp || !from) {
      warnings.push(
        'defina SMTP_URL e MAIL_FROM juntas: recuperação de senha desligada',
      );
    } else if (!/^smtps?:\/\//i.test(smtp)) {
      warnings.push(
        'SMTP_URL precisa começar com smtp:// ou smtps://: recuperação de senha desligada',
      );
    } else if (!publicUrl) {
      warnings.push(
        'SMTP_URL sem SITE_URL: o e-mail não teria para onde levar o aluno; recuperação de senha desligada',
      );
    } else {
      mail = { url: smtp, from };
    }
  }

  let google: GoogleConfig | null = null;
  const clientId = texto(env.GOOGLE_CLIENT_ID);
  const clientSecret = texto(env.GOOGLE_CLIENT_SECRET);
  if (clientId || clientSecret) {
    if (!clientId || !clientSecret) {
      warnings.push(
        'defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET juntas: login com Google desligado',
      );
    } else if (!publicUrl) {
      warnings.push(
        'GOOGLE_CLIENT_ID sem SITE_URL: o Google não teria para onde voltar; login com Google desligado',
      );
    } else {
      google = { clientId, clientSecret };
    }
  }

  return { publicUrl, mail, google, warnings };
}

/** Link do e-mail. O token vai no fragmento: não aparece em log de servidor. */
export function passwordResetLink(publicUrl: string, token: string): string {
  return `${publicUrl}/app/redefinir-senha#token=${encodeURIComponent(token)}`;
}

/** Endereço que o Google chama de volta (cadastrado no Google Cloud). */
export function googleRedirectUri(publicUrl: string): string {
  return `${publicUrl}/api/v1/auth/google/callback`;
}

/** Tela do app que recebe a volta do Google (`#code=` ou `#erro=`). */
export function googleReturnUrl(
  publicUrl: string,
  result: { code: string } | { error: string },
): string {
  const fragmento =
    'code' in result
      ? `code=${encodeURIComponent(result.code)}`
      : `erro=${encodeURIComponent(result.error)}`;
  return `${publicUrl}/app/entrar/google#${fragmento}`;
}
