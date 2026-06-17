import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: { findUnique: jest.Mock; create: jest.Mock } };
  let jwt: { signAsync: jest.Mock };

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn(), create: jest.fn() } };
    jwt = { signAsync: jest.fn().mockResolvedValue('signed-token') };
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
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
  });
});
