import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { VideosService } from './videos.service';

const oEmbedActual =
  jest.requireActual<typeof import('./youtube-oembed')>('./youtube-oembed');

// O service não deve depender de rede nos testes unitários: mock do oEmbed.
jest.mock('./youtube-oembed', () => ({
  ...jest.requireActual('./youtube-oembed'),
  fetchYouTubeMetadata: jest.fn().mockResolvedValue({
    title: 'Aula de Funções',
    thumbnail: 'https://i.ytimg.com/vi/x/hq.jpg',
  }),
}));

const { extractYouTubeId, fetchYouTubeMetadata } = oEmbedActual;

describe('youtube-oembed (issue #37)', () => {
  describe('extractYouTubeId', () => {
    it('extrai de watch, short, embed, youtu.be e ID puro', () => {
      expect(extractYouTubeId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(
        extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
      ).toBe('dQw4w9WgXcQ');
      expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe(
        'dQw4w9WgXcQ',
      );
      expect(
        extractYouTubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ'),
      ).toBe('dQw4w9WgXcQ');
      expect(
        extractYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ'),
      ).toBe('dQw4w9WgXcQ');
      expect(extractYouTubeId('https://www.youtube.com/live/dQw4w9WgXcQ')).toBe(
        'dQw4w9WgXcQ',
      );
    });

    it('retorna null para links inválidos', () => {
      expect(extractYouTubeId('https://vimeo.com/123')).toBeNull();
      expect(extractYouTubeId('qualquer texto')).toBeNull();
      expect(extractYouTubeId('')).toBeNull();
    });
  });

  describe('fetchYouTubeMetadata', () => {
    afterEach(() => jest.restoreAllMocks());

    it('retorna título e thumbnail do oEmbed', async () => {
      const fake = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            title: 'Aula de Funções',
            thumbnail_url: 'https://i.ytimg.com/vi/x/hq.jpg',
          }),
      });
      jest.spyOn(global, 'fetch').mockImplementation(fake);

      const meta = await fetchYouTubeMetadata('dQw4w9WgXcQ');
      expect(meta).toEqual({
        title: 'Aula de Funções',
        thumbnail: 'https://i.ytimg.com/vi/x/hq.jpg',
      });
      expect(fake.mock.calls[0][0]).toContain('youtube.com/oembed');
    });

    it('falha silenciosa sem rede (fallback null)', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'));
      const meta = await fetchYouTubeMetadata('dQw4w9WgXcQ');
      expect(meta).toEqual({ title: null, thumbnail: null });
    });
  });
});

function makeService() {
  const prisma = {
    subject: { findUnique: jest.fn().mockResolvedValue({ id: 's1' }) },
    topic: { findUnique: jest.fn().mockResolvedValue({ id: 't1' }) },
    video: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    videoNote: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  } as any;
  const service = new VideosService(prisma);
  return { service, prisma };
}

describe('VideosService (issue #37)', () => {
  it('create() extrai o ID e salva com metadados do oEmbed', async () => {
    const { service, prisma } = makeService();
    prisma.video.create.mockResolvedValue({
      id: 'v1',
      youtubeId: 'dQw4w9WgXcQ',
      title: 'Aula de Funções',
      thumbnail: 'https://i.ytimg.com/vi/x/hq.jpg',
      subjectId: 's1',
      watched: false,
      createdAt: new Date(),
      subject: { name: 'Matemática' },
      notes: [],
    });

    const res = await service.create('u1', {
      url: 'https://youtu.be/dQw4w9WgXcQ',
      subjectId: 's1',
    });

    expect(prisma.video.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'u1',
          youtubeId: 'dQw4w9WgXcQ',
        }),
      }),
    );
    expect(res.subjectName).toBe('Matemática');
  });

  it('create() rejeita link inválido e matéria inexistente', async () => {
    const { service, prisma } = makeService();
    prisma.subject.findUnique.mockResolvedValue(null);
    await expect(
      service.create('u1', { url: 'https://vimeo.com/x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.create('u1', {
        url: 'https://youtu.be/dQw4w9WgXcQ',
        subjectId: 'nao-existe',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.video.create).not.toHaveBeenCalled();
  });

  it('toggleWatched/remove/updateSubject validam posse (403/404)', async () => {
    const { service, prisma } = makeService();
    prisma.video.findUnique
      .mockResolvedValueOnce(null) // inexistente
      .mockResolvedValueOnce({ userId: 'outro', watched: false }) // alheio
      .mockResolvedValueOnce({ userId: 'outro' }) // remove alheio
      .mockResolvedValueOnce({ userId: 'u1' }); // updateSubject ok

    await expect(service.toggleWatched('u1', 'x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.toggleWatched('u1', 'x')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.remove('u1', 'x')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    prisma.video.update.mockResolvedValue({
      id: 'v1',
      youtubeId: 'x',
      title: 'T',
      thumbnail: null,
      subjectId: null,
      watched: false,
      createdAt: new Date(),
      subject: null,
      notes: [],
    });
    const res = await service.updateSubject('u1', 'v1', { subjectId: null });
    expect(res.subjectName).toBeNull();
  });

  it('notas: add com timestamp, lista ordenada, remove com posse', async () => {
    const { service, prisma } = makeService();
    prisma.video.findUnique.mockResolvedValue({ userId: 'u1' });
    prisma.videoNote.create.mockResolvedValue({
      id: 'n1',
      timestampSec: 42,
      content: 'importante',
      createdAt: new Date(),
    });

    const note = await service.addNote('u1', 'v1', {
      timestampSec: 42,
      content: 'importante',
    });
    expect(note.timestampSec).toBe(42);

    prisma.videoNote.findUnique.mockResolvedValue({ userId: 'outro' });
    await expect(service.removeNote('u1', 'n1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
