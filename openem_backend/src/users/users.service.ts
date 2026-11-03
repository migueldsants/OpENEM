import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { SessionsService } from '../auth/sessions.service';
import {
  activeStreak,
  levelFromXp,
  leagueForLevel,
  ACHIEVEMENTS,
  visibleAchievements,
} from '../common/gamification';
import { publicName } from '../common/nickname';
import { PrismaService } from '../prisma/prisma.service';
import { LoginAttemptsService } from '../rate-limit/login-attempts.service';
import { buildExport, EXPORT_SELECT } from './data-export';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { isNicknameTaken, NICKNAME_TAKEN } from './nickname-taken';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attempts: LoginAttemptsService,
    private readonly sessions: SessionsService,
  ) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        createdAt: true,
        passwordHash: true,
        googleSub: true,
        profile: {
          select: {
            goal: true,
            minutesPerDay: true,
            displayName: true,
            nickname: true,
            focusMode: true,
            gamificationEnabled: true,
            onboarded: true,
            foreignLanguage: true,
          },
        },
      },
    });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    // O hash e o id do Google nunca saem: o app só precisa saber se existem.
    const { passwordHash, googleSub, ...rest } = user;
    return {
      ...rest,
      hasPassword: passwordHash !== null,
      googleLinked: googleSub !== null,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    try {
      await this.prisma.profile.upsert({
        where: { userId },
        update: dto,
        create: { userId, ...dto },
      });
    } catch (err) {
      if (isNicknameTaken(err)) throw new ConflictException(NICKNAME_TAKEN);
      throw err;
    }
    return this.getMe(userId);
  }

  /** Todos os dados do aluno, num JSON só (LGPD art. 18, II e V). */
  async exportData(userId: string, now = new Date()) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: EXPORT_SELECT,
    });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    return buildExport(user, now);
  }

  /**
   * Exclui a conta (LGPD art. 18, VI) depois de conferir a senha atual. O
   * cascade do schema leva tudo o que é do aluno, inclusive tópicos do fórum
   * com as respostas dos outros e decks e temas publicados.
   */
  async deleteAccount(userId: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, passwordHash: true },
    });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    // O mesmo limite por conta do login: quem tem só o token na mão não
    // consegue testar senhas à vontade por esta rota.
    // Conta só do Google não tem senha para confirmar: o aluno cria uma pelo
    // "Esqueci minha senha", como na troca de senha.
    if (!user.passwordHash) {
      throw new BadRequestException(
        'Esta conta entra pelo Google e ainda não tem senha. Para excluí-la, crie uma senha com "Esqueci minha senha" na tela de entrada.',
      );
    }
    await this.attempts.assertAllowed(user.email);
    if (!(await argon2.verify(user.passwordHash, password))) {
      await this.attempts.recordFailure(user.email);
      // 403, não 401: o token vale, a senha é que está errada (e o app trata
      // 401 como sessão expirada e desloga).
      throw new ForbiddenException('Senha incorreta');
    }
    await this.prisma.$transaction([
      // Curtidas e votos do aluno saem dos totais dos temas e decks dos
      // outros, que não são recontados a partir das linhas.
      this.prisma.userTheme.updateMany({
        where: { likeRows: { some: { userId } }, likes: { gt: 0 } },
        data: { likes: { decrement: 1 } },
      }),
      this.prisma.flashcardDeck.updateMany({
        where: { votes: { some: { userId, vote: 'up' } }, upvotes: { gt: 0 } },
        data: { upvotes: { decrement: 1 } },
      }),
      this.prisma.flashcardDeck.updateMany({
        where: {
          votes: { some: { userId, vote: 'down' } },
          downvotes: { gt: 0 },
        },
        data: { downvotes: { decrement: 1 } },
      }),
      this.prisma.user.delete({ where: { id: userId } }),
    ]);
    // Derruba na hora os tokens dos outros aparelhos (a versão fica em cache).
    await this.sessions.forget(userId);
    // Um cadastro novo com o mesmo e-mail não herda as falhas desta conta.
    await this.attempts.recordSuccess(user.email);
  }

  /**
   * Perfil público de um usuário (issue #19). Expõe apenas dados não-sensíveis:
   * apelido, objetivo, nível, liga, XP total e conquistas em destaque.
   * Nunca expõe e-mail ou outros PII. Se o usuário não existe, 404.
   *
   * Quem desligou a gamificação (`gamificationEnabled`) já some do ranking dos
   * outros; aqui também: o perfil sai só com nome, objetivo e data, sem XP,
   * nível, sequência nem conquistas.
   */
  async getPublicProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        createdAt: true,
        profile: {
          select: { nickname: true, goal: true, gamificationEnabled: true },
        },
        gamification: {
          select: { points: true, currentStreak: true, lastActivityOn: true },
        },
        achievements: { select: { code: true, unlockedAt: true } },
      },
    });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const base = {
      id: user.id,
      // O apelido, nunca o nome de exibição: esse fica só para o próprio aluno.
      nickname: publicName(user.profile),
      goal: user.profile?.goal ?? 'SISU',
      createdAt: user.createdAt,
    };
    // Sem perfil vale o padrão do schema (gamificação ligada).
    if (user.profile?.gamificationEnabled === false) {
      return { ...base, gamificationEnabled: false as const };
    }

    const xp = user.gamification?.points ?? 0;
    const levelInfo = levelFromXp(xp);
    const league = leagueForLevel(levelInfo.level);
    const unlockedCodes = new Set(user.achievements.map((a) => a.code));
    // Conquistas em destaque: até 4 desbloqueadas (pela ordem do catálogo).
    const featured = ACHIEVEMENTS.filter((a) => unlockedCodes.has(a.code))
      .slice(0, 4)
      .map((a) => ({ code: a.code, name: a.name, description: a.description }));

    return {
      ...base,
      gamificationEnabled: true as const,
      xp,
      level: levelInfo.level,
      league: { key: league.key, name: league.name },
      // Sequência gravada que já quebrou (última atividade antes de ontem) é 0.
      currentStreak: user.gamification ? activeStreak(user.gamification) : 0,
      achievementsUnlocked: unlockedCodes.size,
      achievementsTotal: visibleAchievements(unlockedCodes).length,
      featuredAchievements: featured,
    };
  }
}
