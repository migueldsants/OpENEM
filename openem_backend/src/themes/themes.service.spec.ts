import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { THEME_TOKEN_KEYS } from '../common/theme-tokens';
import { MAX_THEMES_PER_USER, ThemesService } from './themes.service';

const tokens = (hex: string) =>
  Object.fromEntries(THEME_TOKEN_KEYS.map((k) => [k, hex]));

function row(over: Record<string, unknown> = {}) {
  return {
    id: 'th-1',
    ownerId: 'u-1',
    name: 'Mar',
    light: JSON.stringify(tokens('#ffffff')),
    dark: JSON.stringify(tokens('#000000')),
    isPublic: false,
    likes: 0,
    publishedAt: null,
    updatedAt: new Date('2026-09-29T12:00:00Z'),
    owner: { profile: { nickname: 'Ana' } },
    ...over,
  };
}

function p2002() {
  return new Prisma.PrismaClientKnownRequestError('unique', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

function makeService() {
  const prisma = {
    userTheme: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    userThemeLike: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((fn: (tx: typeof prisma) => unknown) =>
    fn(prisma),
  );
  return { service: new ThemesService(prisma as any), prisma };
}

describe('ThemesService', () => {
  describe('mine()', () => {
    it('lista do dono, pula registro corrompido e não expõe e-mail', async () => {
      const { service, prisma } = makeService();
      prisma.userTheme.findMany.mockResolvedValue([
        row(),
        row({ id: 'th-2', light: '{quebrado' }),
        row({ id: 'th-3', owner: { profile: null } }),
      ]);
      const out = await service.mine('u-1');
      expect(prisma.userTheme.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { ownerId: 'u-1' },
          orderBy: { updatedAt: 'desc' },
        }),
      );
      expect(out.map((t) => t.id)).toEqual(['th-1', 'th-3']);
      expect(out[0]).toMatchObject({
        name: 'Mar',
        mine: true,
        liked: false,
        author: 'Ana',
      });
      expect(out[0].light.bg).toBe('#ffffff');
      expect(out[1].author).toBe('Estudante');
      expect(JSON.stringify(out)).not.toContain('ownerId');
    });
  });

  describe('community()', () => {
    it('só públicos; populares por curtidas e marca o que o aluno curtiu', async () => {
      const { service, prisma } = makeService();
      prisma.userTheme.findMany.mockResolvedValue([
        { ...row({ isPublic: true, likes: 3 }), likeRows: [{ id: 'l' }] },
        {
          ...row({ id: 'th-2', ownerId: 'u-9', isPublic: true }),
          likeRows: [],
        },
      ]);
      const out = await service.community('u-9');
      const arg = prisma.userTheme.findMany.mock.calls[0][0];
      expect(arg.where).toEqual({ isPublic: true });
      expect(arg.orderBy[0]).toEqual({ likes: 'desc' });
      expect(arg.take).toBe(30);
      expect(arg.skip).toBe(0);
      expect(arg.select.likeRows).toEqual({
        where: { userId: 'u-9' },
        select: { id: true },
      });
      expect(out[0]).toMatchObject({ liked: true, mine: false, likes: 3 });
      expect(out[1]).toMatchObject({ liked: false, mine: true });
    });

    it('recentes por data de publicação, com paginação', async () => {
      const { service, prisma } = makeService();
      prisma.userTheme.findMany.mockResolvedValue([]);
      await service.community('u-1', 'recent', 10, 20);
      const arg = prisma.userTheme.findMany.mock.calls[0][0];
      expect(arg.orderBy[0]).toEqual({ publishedAt: 'desc' });
      expect(arg.take).toBe(10);
      expect(arg.skip).toBe(20);
    });
  });

  describe('create()', () => {
    it('grava JSON normalizado e nasce privado', async () => {
      const { service, prisma } = makeService();
      prisma.userTheme.create.mockResolvedValue(row());
      await service.create('u-1', {
        name: '  Mar ',
        light: tokens('#FFFFFF'),
        dark: tokens('#000000'),
      });
      const data = prisma.userTheme.create.mock.calls[0][0].data;
      expect(data).toMatchObject({
        ownerId: 'u-1',
        name: 'Mar',
        isPublic: false,
        publishedAt: null,
      });
      expect(JSON.parse(data.light).bg).toBe('#ffffff');
    });

    it('publicado já recebe a data de publicação', async () => {
      const { service, prisma } = makeService();
      prisma.userTheme.create.mockResolvedValue(row({ isPublic: true }));
      await service.create('u-1', {
        name: 'Mar',
        light: tokens('#ffffff'),
        dark: tokens('#000000'),
        isPublic: true,
      });
      const data = prisma.userTheme.create.mock.calls[0][0].data;
      expect(data.isPublic).toBe(true);
      expect(data.publishedAt).toBeInstanceOf(Date);
    });

    it('recusa cor que não é hex mesmo sem passar pelo DTO', async () => {
      const { service, prisma } = makeService();
      await expect(
        service.create('u-1', {
          name: 'Mar',
          light: { ...tokens('#ffffff'), bg: 'url(x)' },
          dark: tokens('#000000'),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.userTheme.create).not.toHaveBeenCalled();
    });

    it('respeita o limite por aluno', async () => {
      const { service, prisma } = makeService();
      prisma.userTheme.count.mockResolvedValue(MAX_THEMES_PER_USER);
      await expect(
        service.create('u-1', {
          name: 'Mar',
          light: tokens('#ffffff'),
          dark: tokens('#000000'),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('nome repetido vira 409', async () => {
      const { service, prisma } = makeService();
      prisma.userTheme.create.mockRejectedValue(p2002());
      await expect(
        service.create('u-1', {
          name: 'Mar',
          light: tokens('#ffffff'),
          dark: tokens('#000000'),
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('update()', () => {
    it('tema de outro aluno é 404', async () => {
      const { service, prisma } = makeService();
      prisma.userTheme.findUnique.mockResolvedValue({
        id: 'th-1',
        ownerId: 'u-2',
        isPublic: true,
      });
      await expect(
        service.update('u-1', 'th-1', { name: 'X' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.userTheme.update).not.toHaveBeenCalled();
    });

    it('publicar marca a data; despublicar não mexe nela', async () => {
      const { service, prisma } = makeService();
      prisma.userTheme.update.mockResolvedValue(row());
      prisma.userTheme.findUnique.mockResolvedValue({
        id: 'th-1',
        ownerId: 'u-1',
        isPublic: false,
      });
      await service.update('u-1', 'th-1', { isPublic: true });
      expect(prisma.userTheme.update.mock.calls[0][0].data).toMatchObject({
        isPublic: true,
        publishedAt: expect.any(Date),
      });

      prisma.userTheme.findUnique.mockResolvedValue({
        id: 'th-1',
        ownerId: 'u-1',
        isPublic: true,
      });
      await service.update('u-1', 'th-1', {
        isPublic: false,
        dark: tokens('#111111'),
      });
      const data = prisma.userTheme.update.mock.calls[1][0].data;
      expect(data).toEqual({
        isPublic: false,
        dark: JSON.stringify(tokens('#111111')),
      });
    });

    it('renomear para nome já usado vira 409', async () => {
      const { service, prisma } = makeService();
      prisma.userTheme.findUnique.mockResolvedValue({
        id: 'th-1',
        ownerId: 'u-1',
        isPublic: false,
      });
      prisma.userTheme.update.mockRejectedValue(p2002());
      await expect(
        service.update('u-1', 'th-1', { name: 'Outro' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('remove()', () => {
    it('apaga só o próprio', async () => {
      const { service, prisma } = makeService();
      prisma.userTheme.findUnique.mockResolvedValue(null);
      await expect(service.remove('u-1', 'x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      prisma.userTheme.findUnique.mockResolvedValue({
        id: 'th-1',
        ownerId: 'u-1',
        isPublic: false,
      });
      await expect(service.remove('u-1', 'th-1')).resolves.toEqual({
        removed: true,
      });
      expect(prisma.userTheme.delete).toHaveBeenCalledWith({
        where: { id: 'th-1' },
      });
    });
  });

  describe('toggleLike()', () => {
    it('curte (cria linha e incrementa) e descurte (apaga e decrementa)', async () => {
      const { service, prisma } = makeService();
      prisma.userTheme.findUnique.mockResolvedValue({
        ownerId: 'u-2',
        isPublic: true,
      });
      prisma.userThemeLike.findUnique.mockResolvedValue(null);
      prisma.userTheme.update.mockResolvedValue({ likes: 1 });
      await expect(service.toggleLike('u-1', 'th-1')).resolves.toEqual({
        liked: true,
        likes: 1,
      });
      expect(prisma.userThemeLike.create).toHaveBeenCalledWith({
        data: { themeId: 'th-1', userId: 'u-1' },
      });
      expect(prisma.userTheme.update.mock.calls[0][0].data).toEqual({
        likes: { increment: 1 },
      });

      prisma.userThemeLike.findUnique.mockResolvedValue({ id: 'lk-1' });
      prisma.userTheme.update.mockResolvedValue({ likes: 0 });
      await expect(service.toggleLike('u-1', 'th-1')).resolves.toEqual({
        liked: false,
        likes: 0,
      });
      expect(prisma.userThemeLike.delete).toHaveBeenCalledWith({
        where: { id: 'lk-1' },
      });
      expect(prisma.userTheme.update.mock.calls[1][0].data).toEqual({
        likes: { decrement: 1 },
      });
    });

    it('tema privado ou inexistente é 404', async () => {
      const { service, prisma } = makeService();
      prisma.userTheme.findUnique.mockResolvedValue({
        ownerId: 'u-2',
        isPublic: false,
      });
      await expect(service.toggleLike('u-1', 'th-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      prisma.userTheme.findUnique.mockResolvedValue(null);
      await expect(service.toggleLike('u-1', 'th-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('não curte o próprio tema', async () => {
      const { service, prisma } = makeService();
      prisma.userTheme.findUnique.mockResolvedValue({
        ownerId: 'u-1',
        isPublic: true,
      });
      await expect(service.toggleLike('u-1', 'th-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.userThemeLike.create).not.toHaveBeenCalled();
    });

    it('corrida no @@unique vira 409', async () => {
      const { service, prisma } = makeService();
      prisma.$transaction.mockRejectedValue(p2002());
      await expect(service.toggleLike('u-1', 'th-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });
});
