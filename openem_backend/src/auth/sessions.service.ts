import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Prisma } from '@prisma/client';
import { CacheService } from '../cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';

export interface AuthResult {
  accessToken: string;
  user: { id: string; email: string };
}

/**
 * Quanto tempo a versão dos tokens de um aluno fica no cache. Encerrar as
 * sessões grava a versão nova na hora; o prazo só cobre a corrida rara de uma
 * leitura antiga gravada logo depois.
 */
export const TOKEN_VERSION_TTL_MS = 30_000;

function versionKey(userId: string): string[] {
  return ['auth', 'token-version', userId];
}

/**
 * Sessões de login. O JWT leva a versão de token do aluno (`ver`); a
 * `JwtStrategy` confere a versão a cada pedido, e incrementá-la derruba todos
 * os tokens emitidos antes. Token antigo, de antes do campo existir, não tem
 * `ver` e vale como versão 0.
 */
@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly cache: CacheService,
  ) {}

  async issue(user: {
    id: string;
    email: string;
    tokenVersion: number;
  }): Promise<AuthResult> {
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      ver: user.tokenVersion,
    });
    return { accessToken, user: { id: user.id, email: user.email } };
  }

  /** Versão atual dos tokens do aluno; null se a conta não existe mais. */
  async currentVersion(userId: string): Promise<number | null> {
    const version = await this.cache.getOrSet<number | undefined>(
      versionKey(userId),
      TOKEN_VERSION_TTL_MS,
      async () =>
        (
          await this.prisma.user.findUnique({
            where: { id: userId },
            select: { tokenVersion: true },
          })
        )?.tokenVersion,
    );
    return version ?? null;
  }

  /**
   * Encerra todas as sessões do aluno, junto com outras mudanças na conta
   * (senha nova, por exemplo). Devolve a conta com a versão nova, para emitir
   * o token de quem continua logado.
   */
  async revokeAll(
    userId: string,
    data: Omit<Prisma.UserUpdateInput, 'tokenVersion'> = {},
  ): Promise<{ id: string; email: string; tokenVersion: number }> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { ...data, tokenVersion: { increment: 1 } },
      select: { id: true, email: true, tokenVersion: true },
    });
    await this.cache.set(
      versionKey(userId),
      user.tokenVersion,
      TOKEN_VERSION_TTL_MS,
    );
    return user;
  }

  /**
   * Esquece a versão em cache depois que a conta é excluída: o próximo pedido
   * relê o banco, não acha a conta e recusa o token. Sem isso, o token do
   * outro aparelho valeria até o cache vencer.
   */
  async forget(userId: string): Promise<void> {
    await this.cache.del(versionKey(userId));
  }
}
