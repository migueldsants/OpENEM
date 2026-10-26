import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { MemoryCacheStore } from '../cache/cache-store';
import { memoryCache } from '../cache/testing';
import { PrismaService } from '../prisma/prisma.service';
import {
  LoginAttemptsService,
  TooManyAttemptsException,
} from '../rate-limit/login-attempts.service';
import { AuthService } from './auth.service';
import { fakeAuthPrisma } from './fake-auth-prisma';
import { SessionsService } from './sessions.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock; findFirst: jest.Mock; create: jest.Mock };
  };
  let jwt: { signAsync: jest.Mock };
  let attempts: LoginAttemptsService;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
    };
    jwt = { signAsync: jest.fn().mockResolvedValue('signed-token') };
    attempts = new LoginAttemptsService(new MemoryCacheStore(), 'rl');
    service = new AuthService(
      prisma as unknown as PrismaService,
      new SessionsService(
        prisma as unknown as PrismaService,
        jwt as unknown as JwtService,
        memoryCache(),
      ),
      attempts,
    );
  });

  describe('register', () => {
    it('cria usuário, faz hash da senha e retorna token', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'u1', email: 'a@b.com' });

      const res = await service.register({
        email: 'a@b.com',
        password: 'password123',
      });

      expect(res.accessToken).toBe('signed-token');
      expect(res.user).toEqual({ id: 'u1', email: 'a@b.com' });
      const createArg = prisma.user.create.mock.calls[0][0] as {
        data: { passwordHash: string };
      };
      expect(createArg.data.passwordHash).not.toBe('password123');
      expect(createArg.data.passwordHash).toMatch(/^\$argon2/);
    });

    it('rejeita e-mail já cadastrado', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      await expect(
        service.register({ email: 'a@b.com', password: 'password123' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('grava o e-mail em minúsculas e sem espaços', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'u1', email: 'ana@b.com' });

      await service.register({ email: ' Ana@B.com ', password: 'password123' });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'ana@b.com' },
      });
      const createArg = prisma.user.create.mock.calls[0][0] as {
        data: { email: string };
      };
      expect(createArg.data.email).toBe('ana@b.com');
    });

    it('recusa o mesmo e-mail com outra caixa numa conta antiga', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue({ id: 'antiga' });
      await expect(
        service.register({ email: 'ana@b.com', password: 'password123' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: { equals: 'ana@b.com', mode: 'insensitive' } },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('login', () => {
    it('retorna token para credenciais válidas', async () => {
      const passwordHash = await argon2.hash('password123');
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        passwordHash,
      });

      const res = await service.login({
        email: 'a@b.com',
        password: 'password123',
      });
      expect(res.accessToken).toBe('signed-token');
    });

    it('entra com o e-mail digitado em outra caixa', async () => {
      const passwordHash = await argon2.hash('password123');
      prisma.user.findUnique.mockImplementation(
        ({ where }: { where: { email: string } }) =>
          Promise.resolve(
            where.email === 'ana@b.com'
              ? { id: 'u1', email: 'ana@b.com', passwordHash }
              : null,
          ),
      );
      const res = await service.login({
        email: 'Ana@B.com',
        password: 'password123',
      });
      expect(res.user.email).toBe('ana@b.com');
    });

    it('acha conta antiga gravada com maiúsculas', async () => {
      const passwordHash = await argon2.hash('password123');
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        email: 'Ana@B.com',
        passwordHash,
      });
      const res = await service.login({
        email: 'ana@b.com',
        password: 'password123',
      });
      expect(res.user.id).toBe('u1');
    });

    it('rejeita e-mail inexistente com 401 genérico', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.login({ email: 'x@y.com', password: 'whatever1' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejeita senha incorreta', async () => {
      const passwordHash = await argon2.hash('senha-correta');
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        passwordHash,
      });
      await expect(
        service.login({ email: 'a@b.com', password: 'senha-errada' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('a quinta senha errada bloqueia a conta, mesmo com a senha certa depois', async () => {
      const passwordHash = await argon2.hash('senha-correta');
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        passwordHash,
      });
      for (let i = 0; i < 4; i++) {
        await expect(
          service.login({ email: 'a@b.com', password: 'errada' }),
        ).rejects.toBeInstanceOf(UnauthorizedException);
      }
      await expect(
        service.login({ email: 'a@b.com', password: 'errada' }),
      ).rejects.toBeInstanceOf(TooManyAttemptsException);
      await expect(
        service.login({ email: 'A@B.com ', password: 'senha-correta' }),
      ).rejects.toBeInstanceOf(TooManyAttemptsException);
    });

    it('conta só do Google (sem senha) responde igual a e-mail sem conta', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        passwordHash: null,
      });
      await expect(
        service.login({ email: 'a@b.com', password: 'qualquer1' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('e-mail sem conta bloqueia igual (sem revelar quais existem)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      for (let i = 0; i < 4; i++) {
        await expect(
          service.login({ email: 'x@y.com', password: 'whatever1' }),
        ).rejects.toBeInstanceOf(UnauthorizedException);
      }
      await expect(
        service.login({ email: 'x@y.com', password: 'whatever1' }),
      ).rejects.toBeInstanceOf(TooManyAttemptsException);
    });

    it('login certo zera as falhas', async () => {
      const passwordHash = await argon2.hash('senha-correta');
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        passwordHash,
      });
      for (let i = 0; i < 4; i++) {
        await service
          .login({ email: 'a@b.com', password: 'errada' })
          .catch(() => undefined);
      }
      await service.login({ email: 'a@b.com', password: 'senha-correta' });
      // Mais quatro erros cabem de novo antes do bloqueio.
      for (let i = 0; i < 4; i++) {
        await expect(
          service.login({ email: 'a@b.com', password: 'errada' }),
        ).rejects.toBeInstanceOf(UnauthorizedException);
      }
    });
  });

  describe('changePassword e logoutAll', () => {
    const jwtReal = new JwtService({ secret: 'segredo-de-teste-comprido' });
    let fake: ReturnType<typeof fakeAuthPrisma>;
    let auth: AuthService;
    let userId: string;

    beforeEach(async () => {
      fake = fakeAuthPrisma();
      const sessions = new SessionsService(
        fake as unknown as PrismaService,
        jwtReal,
        memoryCache(),
      );
      auth = new AuthService(
        fake as unknown as PrismaService,
        sessions,
        new LoginAttemptsService(new MemoryCacheStore(), 'rl'),
      );
      userId = (
        await fake.user.create({
          data: {
            email: 'a@b.com',
            passwordHash: await argon2.hash('senha-antiga'),
          },
        })
      ).id as string;
    });

    it('troca a senha, sobe a versão e devolve um token novo', async () => {
      const res = await auth.changePassword(userId, {
        currentPassword: 'senha-antiga',
        newPassword: 'senha-nova-1',
      });
      const user = fake.tabelas.user[0];
      expect(user.tokenVersion).toBe(1);
      expect(
        await argon2.verify(user.passwordHash as string, 'senha-nova-1'),
      ).toBe(true);
      expect(jwtReal.decode(res.accessToken)).toMatchObject({
        sub: userId,
        ver: 1,
      });
    });

    it('senha atual errada é 400 (não 401, que deslogaria o app)', async () => {
      await expect(
        auth.changePassword(userId, {
          currentPassword: 'errada',
          newPassword: 'senha-nova-1',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(fake.tabelas.user[0].tokenVersion).toBe(0);
    });

    it('recusa a mesma senha', async () => {
      await expect(
        auth.changePassword(userId, {
          currentPassword: 'senha-antiga',
          newPassword: 'senha-antiga',
        }),
      ).rejects.toThrow(/diferente da atual/);
    });

    it('conta sem senha (Google) é orientada a usar o "Esqueci minha senha"', async () => {
      fake.tabelas.user[0].passwordHash = null;
      await expect(
        auth.changePassword(userId, {
          currentPassword: 'x',
          newPassword: 'senha-nova-1',
        }),
      ).rejects.toThrow(/Esqueci minha senha/);
    });

    it('conta inexistente é 404', async () => {
      await expect(
        auth.changePassword('nao-existe', {
          currentPassword: 'x',
          newPassword: 'senha-nova-1',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('logoutAll sobe a versão', async () => {
      await auth.logoutAll(userId);
      await auth.logoutAll(userId);
      expect(fake.tabelas.user[0].tokenVersion).toBe(2);
    });
  });
});
