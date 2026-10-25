import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type AuthFeatures,
  googleRedirectUri,
  googleReturnUrl,
} from '../common/auth-config';
import {
  hashToken,
  LOGIN_CODE_TTL_MS,
  randomToken,
  safeEqual,
} from '../common/auth-tokens';
import {
  checkGoogleClaims,
  GOOGLE_FLOW_TTL_MS,
  type GoogleFlow,
  type GoogleIdentity,
  GoogleLoginError,
  googleAuthorizationUrl,
  tokenRequestBody,
} from '../common/google-oidc';
import { resolveJwtSecret } from '../common/jwt-secret';
import { normalizeEmail } from '../common/rate-limit';
import { openSealedJson, sealJson } from '../common/sealed-cookie';
import { PrismaService } from '../prisma/prisma.service';
import { AUTH_FEATURES } from './auth.tokens';
import { findUserByEmail } from './find-user-by-email';
import { GoogleOidcClient } from './google-oidc.client';
import { type AuthResult, SessionsService } from './sessions.service';

/** Cookie com o `state`, o `nonce` e o PKCE da ida ao Google (cifrado). */
export const GOOGLE_COOKIE = 'openem_google';
/** Só as rotas do Google recebem o cookie. */
export const GOOGLE_COOKIE_PATH = '/api/v1/auth/google';
const COOKIE_PURPOSE = 'google-oidc';

export interface GoogleAuthResult extends AuthResult {
  /** A senha antiga da conta foi desativada no vínculo: o app avisa. */
  passwordDisabled: boolean;
}

export interface GoogleCallbackQuery {
  code?: unknown;
  state?: unknown;
  error?: unknown;
}

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor ? valor : null;
}

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: unknown })?.code === 'P2002';
}

/**
 * Login com Google (OpenID Connect, authorization code com PKCE, `state` e
 * `nonce`). Só liga com `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`.
 *
 * O JWT nunca vai na URL: a volta do Google termina num código de uso único,
 * no fragmento do endereço do app, e o app o troca pelo login por POST.
 */
@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);
  private readonly secret: string;
  /** Relógio; os testes trocam. */
  now: () => number = Date.now;

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: GoogleOidcClient,
    private readonly sessions: SessionsService,
    @Inject(AUTH_FEATURES) private readonly features: AuthFeatures,
    config: ConfigService,
  ) {
    this.secret = resolveJwtSecret(config);
  }

  get enabled(): boolean {
    return this.features.google !== null && this.features.publicUrl !== null;
  }

  private settings() {
    const { google, publicUrl } = this.features;
    if (!google || !publicUrl) {
      throw new NotFoundException(
        'O login com Google não está ligado neste servidor.',
      );
    }
    return { ...google, publicUrl, redirectUri: googleRedirectUri(publicUrl) };
  }

  /** Ida ao Google: o endereço da tela de login e o cookie da volta. */
  start(): { url: string; cookie: string; secure: boolean } {
    const { clientId, redirectUri, publicUrl } = this.settings();
    const flow: GoogleFlow = {
      state: randomToken(),
      nonce: randomToken(),
      verifier: randomToken(48),
    };
    return {
      url: googleAuthorizationUrl({ clientId, redirectUri, flow }),
      cookie: sealJson(flow, {
        secret: this.secret,
        purpose: COOKIE_PURPOSE,
        nowMs: this.now(),
        ttlMs: GOOGLE_FLOW_TTL_MS,
      }),
      secure: publicUrl.startsWith('https:'),
    };
  }

  /** Volta do Google: sempre um endereço do app, com `#code=` ou `#erro=`. */
  async callback(
    query: GoogleCallbackQuery,
    cookie: string | null,
  ): Promise<string> {
    const { publicUrl } = this.settings();
    try {
      return googleReturnUrl(publicUrl, {
        code: await this.finish(query, cookie),
      });
    } catch (err) {
      const erro =
        err instanceof GoogleLoginError
          ? err
          : new GoogleLoginError(
              'falha',
              (err as Error)?.message ?? String(err),
            );
      if (erro.code === 'falha' || erro.code === 'conta') {
        this.logger.warn(`login com Google recusado: ${erro.message}`);
      }
      return googleReturnUrl(publicUrl, { error: erro.code });
    }
  }

  private async finish(
    query: GoogleCallbackQuery,
    cookie: string | null,
  ): Promise<string> {
    const settings = this.settings();
    const flow = openSealedJson<GoogleFlow>(cookie, {
      secret: this.secret,
      purpose: COOKIE_PURPOSE,
      nowMs: this.now(),
    });
    const state = texto(query.state);
    // Sem o cookie desta aba, a volta pode ter sido montada por outra pessoa
    // (login CSRF): não se confia em nada dela, nem no erro.
    if (!flow || !state || !safeEqual(state, flow.state)) {
      throw new GoogleLoginError('sessao', 'state ausente ou diferente');
    }
    const erro = texto(query.error);
    if (erro) {
      throw new GoogleLoginError(
        erro === 'access_denied' ? 'cancelado' : 'falha',
        `o Google respondeu ${erro}`,
      );
    }
    const code = texto(query.code);
    if (!code) throw new GoogleLoginError('falha', 'volta sem código');

    const idToken = await this.client.exchangeCode(
      tokenRequestBody({
        code,
        verifier: flow.verifier,
        clientId: settings.clientId,
        clientSecret: settings.clientSecret,
        redirectUri: settings.redirectUri,
      }),
    );
    const identity = checkGoogleClaims(
      await this.client.verifiedClaims(idToken),
      {
        clientId: settings.clientId,
        nonce: flow.nonce,
        nowSec: Math.floor(this.now() / 1000),
      },
    );
    const { userId, passwordDisabled } = await this.resolveUser(identity);
    return this.createLoginCode(userId, passwordDisabled);
  }

  /**
   * A conta da identidade Google: a já vinculada, a do mesmo e-mail (que
   * passa a ser vinculada) ou uma nova, sem senha.
   */
  private async resolveUser(
    identity: GoogleIdentity,
  ): Promise<{ userId: string; passwordDisabled: boolean }> {
    const vinculada = await this.prisma.user.findUnique({
      where: { googleSub: identity.sub },
      select: { id: true },
    });
    if (vinculada) return { userId: vinculada.id, passwordDisabled: false };

    const achado = await findUserByEmail(this.prisma, identity.email);
    if (achado.kind === 'ambiguous') {
      throw new GoogleLoginError('conta', 'duas contas com o mesmo e-mail');
    }
    if (achado.kind === 'found') {
      return this.link(achado.user, identity.sub);
    }

    try {
      const nova = await this.prisma.user.create({
        data: {
          email: normalizeEmail(identity.email),
          passwordHash: null,
          googleSub: identity.sub,
          emailVerifiedAt: new Date(this.now()),
          profile: { create: {} },
        },
        select: { id: true },
      });
      return { userId: nova.id, passwordDisabled: false };
    } catch (err) {
      // Duas voltas ao mesmo tempo da mesma conta nova: a outra criou antes.
      if (!isUniqueViolation(err)) throw err;
      const criada = await this.prisma.user.findUnique({
        where: { googleSub: identity.sub },
        select: { id: true },
      });
      if (!criada) throw new GoogleLoginError('conta', 'e-mail tomado no meio');
      return { userId: criada.id, passwordDisabled: false };
    }
  }

  /**
   * Vincula a conta Google a uma conta daqui com o mesmo e-mail. Se a conta
   * tem senha e o e-mail nunca foi confirmado, quem a criou pode não ser o
   * dono do e-mail (alguém cadastra o e-mail de outra pessoa e espera ela
   * entrar pelo Google). O Google acabou de confirmar o e-mail, então a
   * senha sai e as sessões abertas caem; o dono cria outra pelo "Esqueci
   * minha senha".
   */
  private async link(
    user: {
      id: string;
      passwordHash: string | null;
      googleSub: string | null;
      emailVerifiedAt: Date | null;
    },
    sub: string,
  ): Promise<{ userId: string; passwordDisabled: boolean }> {
    if (user.googleSub) {
      throw new GoogleLoginError(
        'conta',
        'o e-mail já está ligado a outra conta Google',
      );
    }
    const desconfiada = !!user.passwordHash && !user.emailVerifiedAt;
    const data = {
      googleSub: sub,
      emailVerifiedAt: user.emailVerifiedAt ?? new Date(this.now()),
    };
    try {
      if (desconfiada) {
        await this.sessions.revokeAll(user.id, { ...data, passwordHash: null });
      } else {
        await this.prisma.user.update({ where: { id: user.id }, data });
      }
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new GoogleLoginError('conta', 'conta Google vinculada no meio');
      }
      throw err;
    }
    return { userId: user.id, passwordDisabled: desconfiada };
  }

  private async createLoginCode(
    userId: string,
    passwordDisabled: boolean,
  ): Promise<string> {
    const code = randomToken();
    const agora = new Date(this.now());
    await this.prisma.$transaction([
      this.prisma.loginCode.deleteMany({ where: { expiresAt: { lt: agora } } }),
      this.prisma.loginCode.create({
        data: {
          userId,
          codeHash: hashToken(code),
          passwordDisabled,
          expiresAt: new Date(agora.getTime() + LOGIN_CODE_TTL_MS),
        },
      }),
    ]);
    return code;
  }

  /**
   * Troca o código da volta pelo login. Apagar a linha é o que gasta o
   * código: de dois pedidos com o mesmo código, só um apaga.
   */
  async exchange(code: string): Promise<GoogleAuthResult> {
    const invalido = new BadRequestException(
      'Este login com o Google expirou. Tente de novo.',
    );
    const registro = await this.prisma.loginCode.findUnique({
      where: { codeHash: hashToken(code) },
      select: {
        id: true,
        expiresAt: true,
        passwordDisabled: true,
        user: { select: { id: true, email: true, tokenVersion: true } },
      },
    });
    if (!registro) throw invalido;
    const gasto = await this.prisma.loginCode.deleteMany({
      where: { id: registro.id },
    });
    if (gasto.count !== 1 || registro.expiresAt.getTime() <= this.now()) {
      throw invalido;
    }
    return {
      ...(await this.sessions.issue(registro.user)),
      passwordDisabled: registro.passwordDisabled,
    };
  }
}
