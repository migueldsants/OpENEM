import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginAttemptsService } from '../rate-limit/login-attempts.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { type AuthResult, SessionsService } from './sessions.service';

export type { AuthResult } from './sessions.service';

let dummyHashPromise: Promise<string> | null = null;

/** Hash argon2 de uma senha aleatória, calculado uma vez por processo. */
export function dummyHash(): Promise<string> {
  dummyHashPromise ??= argon2.hash(randomBytes(16).toString('hex'));
  return dummyHashPromise;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionsService,
    private readonly attempts: LoginAttemptsService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('E-mail já cadastrado');
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        profile: {
          create: { displayName: dto.displayName },
        },
      },
    });

    return this.sessions.issue(user);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    // Conta bloqueada por senhas erradas: recusa antes de olhar a senha, com
    // a mesma resposta para e-mail com e sem conta.
    await this.attempts.assertAllowed(dto.email);
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    // Mensagem genérica: não revela se o e-mail existe.
    const invalid = new UnauthorizedException('Credenciais inválidas');
    if (!user?.passwordHash) {
      // Sem conta (ou conta só do Google, sem senha), verifica a senha contra
      // um hash falso: o tempo da resposta não deixa ver quais e-mails já
      // existem (com argon2, ~5 ms contra ~70 ms).
      await argon2.verify(await dummyHash(), dto.password);
      // Conta como falha também: senão o bloqueio diria quais e-mails existem.
      await this.attempts.recordFailure(dto.email);
      throw invalid;
    }

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      // A quinta falha lança o 429 em vez do 401.
      await this.attempts.recordFailure(dto.email);
      throw invalid;
    }

    await this.attempts.recordSuccess(dto.email);
    return this.sessions.issue(user);
  }

  /**
   * Troca a senha de quem está logado. Encerra todas as sessões, inclusive a
   * de quem roubou o token, e devolve um token novo para este aparelho.
   * Senha atual errada é 400, não 401: o app trata 401 como sessão vencida e
   * deslogaria o aluno por um erro de digitação.
   */
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    if (!user.passwordHash) {
      throw new BadRequestException(
        'Esta conta entra pelo Google e ainda não tem senha. Para criar uma, use "Esqueci minha senha" na tela de entrada.',
      );
    }
    if (!(await argon2.verify(user.passwordHash, dto.currentPassword))) {
      throw new BadRequestException('A senha atual não confere.');
    }
    if (await argon2.verify(user.passwordHash, dto.newPassword)) {
      throw new BadRequestException(
        'A senha nova precisa ser diferente da atual.',
      );
    }
    const passwordHash = await argon2.hash(dto.newPassword);
    return this.sessions.issue(
      await this.sessions.revokeAll(userId, { passwordHash }),
    );
  }

  /** "Sair de todos os dispositivos": nenhum token emitido até aqui vale mais. */
  async logoutAll(userId: string): Promise<void> {
    await this.sessions.revokeAll(userId);
  }
}
