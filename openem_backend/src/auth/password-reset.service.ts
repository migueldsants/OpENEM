import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import type { CacheStore } from '../cache/cache-store';
import type { AuthFeatures } from '../common/auth-config';
import { passwordResetLink } from '../common/auth-config';
import {
  hashToken,
  RESET_EMAIL_LIMIT,
  RESET_EMAIL_WINDOW_MS,
  RESET_TOKEN_TTL_MS,
  randomToken,
  resetEmailKey,
} from '../common/auth-tokens';
import { accountId, retryAfterSeconds } from '../common/rate-limit';
import { MailService } from '../mail/mail.service';
import { passwordResetEmail } from '../mail/templates';
import { PrismaService } from '../prisma/prisma.service';
import {
  LoginAttemptsService,
  TooManyAttemptsException,
} from '../rate-limit/login-attempts.service';
import { RATE_PREFIX, RATE_STORE } from '../rate-limit/rate-limit.tokens';
import { AUTH_FEATURES } from './auth.tokens';
import { findUserByEmail } from './find-user-by-email';
import { type AuthResult, SessionsService } from './sessions.service';

/**
 * "Esqueci minha senha". O pedido responde na hora, sempre igual, e o
 * trabalho (achar a conta, gravar o token, mandar o e-mail) segue em segundo
 * plano: nem a resposta nem o tempo dela dizem se o e-mail tem conta.
 */
@Injectable()
export class PasswordResetService implements OnModuleDestroy {
  private readonly logger = new Logger(PasswordResetService.name);
  /** Envios em andamento: o desligamento espera, e os testes também. */
  private readonly jobs = new Set<Promise<void>>();
  /** Relógio; os testes trocam. */
  now: () => number = Date.now;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly sessions: SessionsService,
    private readonly attempts: LoginAttemptsService,
    @Inject(RATE_STORE) private readonly store: CacheStore,
    @Inject(RATE_PREFIX) private readonly prefix: string,
    @Inject(AUTH_FEATURES) private readonly features: AuthFeatures,
  ) {}

  /** O servidor tem SMTP e endereço público para montar o link. */
  get enabled(): boolean {
    return this.mail.enabled && this.features.publicUrl !== null;
  }

  /**
   * Agenda o e-mail. Lança 503 sem SMTP e 429 depois de três pedidos para o
   * mesmo e-mail em uma hora, conte ele ou não com uma conta (o limite não
   * pode revelar quem tem conta).
   */
  async request(email: string): Promise<void> {
    if (!this.enabled) {
      throw new ServiceUnavailableException(
        'A recuperação de senha por e-mail não está configurada neste servidor.',
      );
    }
    const key = resetEmailKey(this.prefix, accountId(email));
    const pedidos = await this.store.incrWithTtl(key, RESET_EMAIL_WINDOW_MS);
    if (pedidos > RESET_EMAIL_LIMIT) {
      const restante = await this.store.pttl(key);
      throw new TooManyAttemptsException(
        retryAfterSeconds(
          restante !== null && restante > 0 ? restante : RESET_EMAIL_WINDOW_MS,
        ),
      );
    }
    const job = this.deliver(email)
      .catch((err: unknown) =>
        this.logger.error(
          `falha ao enviar o link de redefinição: ${(err as Error)?.message ?? err}`,
        ),
      )
      .finally(() => this.jobs.delete(job));
    this.jobs.add(job);
  }

  /** Espera os envios em andamento. */
  async idle(): Promise<void> {
    await Promise.all([...this.jobs]);
  }

  async onModuleDestroy(): Promise<void> {
    await this.idle();
  }

  private async deliver(email: string): Promise<void> {
    const achado = await findUserByEmail(this.prisma, email);
    if (achado.kind === 'ambiguous') {
      this.logger.warn(
        'pedido de redefinição para um e-mail com duas contas (caixas diferentes); nada enviado',
      );
    }
    if (achado.kind !== 'found') return;
    const { user } = achado;

    const token = randomToken();
    const agora = new Date(this.now());
    await this.prisma.$transaction([
      // Só o link mais novo vale; e os vencidos de todo mundo saem junto.
      this.prisma.passwordResetToken.deleteMany({
        where: { OR: [{ userId: user.id }, { expiresAt: { lt: agora } }] },
      }),
      this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(agora.getTime() + RESET_TOKEN_TTL_MS),
        },
      }),
    ]);

    const link = passwordResetLink(this.features.publicUrl!, token);
    await this.mail.send(
      user.email,
      passwordResetEmail(link, RESET_TOKEN_TTL_MS / 60_000),
    );
  }

  /**
   * Troca a senha pelo link. O token vale uma vez: marcar como usado é a
   * mesma operação que confere o prazo, então dois envios do mesmo link não
   * passam os dois. Encerra as outras sessões e já devolve o login.
   */
  async reset(token: string, password: string): Promise<AuthResult> {
    const agora = new Date(this.now());
    const tokenHash = hashToken(token);
    const usado = await this.prisma.passwordResetToken.updateMany({
      where: { tokenHash, usedAt: null, expiresAt: { gt: agora } },
      data: { usedAt: agora },
    });
    const registro =
      usado.count === 1
        ? await this.prisma.passwordResetToken.findUnique({
            where: { tokenHash },
            select: {
              userId: true,
              user: { select: { emailVerifiedAt: true } },
            },
          })
        : null;
    if (!registro) {
      throw new BadRequestException(
        'Este link expirou ou já foi usado. Peça um novo em "Esqueci minha senha".',
      );
    }

    const passwordHash = await argon2.hash(password);
    const user = await this.sessions.revokeAll(registro.userId, {
      passwordHash,
      // Quem abriu o link do e-mail provou que o e-mail é dele.
      emailVerifiedAt: registro.user.emailVerifiedAt ?? agora,
    });
    await this.prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });
    // Senha nova, contagem nova: o bloqueio por senhas erradas não prende o dono.
    await this.attempts.clear(user.email);
    return this.sessions.issue(user);
  }
}
