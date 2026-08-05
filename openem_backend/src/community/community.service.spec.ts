import { NotFoundException } from '@nestjs/common';
import { CommunityService } from './community.service';

// Tipos mínimos para os mocks do Prisma (mantém o teste legível sem depender do
// tipo completo do PrismaService).
type ThreadRow = {
  id: string;
  title: string;
  body: string;
  createdAt: Date;
  questionId: string | null;
  user: { id: string; profile: { displayName: string | null } | null };
  posts: {
    id: string;
    body: string;
    createdAt: Date;
    user: { id: string; profile: { displayName: string | null } | null };
  }[];
  _count?: { posts: number };
};

function makePrismaMock() {
  const threads = new Map<string, ThreadRow>();
  const posts = new Map<string, ThreadRow['posts'][number]>();
  let idCounter = 0;
  const nextId = () => `id-${++idCounter}`;

  return {
    threads,
    posts,
    question: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        where.id.startsWith('q-') ? { id: where.id } : null,
      ),
    },
    forumThread: {
      create: jest.fn(async ({ data }: { data: any }) => {
        const id = nextId();
        const row: ThreadRow = {
          id,
          title: data.title,
          body: data.body,
          createdAt: new Date(),
          questionId: data.questionId ?? null,
          user: { id: data.userId, profile: { displayName: 'Autor' } },
          posts: [],
        };
        threads.set(id, row);
        return { id };
      }),
      findMany: jest.fn(async () =>
        Array.from(threads.values()).map((t) => ({
          id: t.id,
          title: t.title,
          createdAt: t.createdAt,
          questionId: t.questionId,
          user: t.user,
          _count: { posts: t.posts.length },
        })),
      ),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        threads.get(where.id) ?? null,
      ),
    },
    forumPost: {
      create: jest.fn(async ({ data }: { data: any }) => {
        const id = nextId();
        const post = {
          id,
          body: data.body,
          createdAt: new Date(),
          user: { id: data.userId, profile: { displayName: 'Replyer' } },
        };
        posts.set(id, post);
        const thread = threads.get(data.threadId);
        thread?.posts.push(post);
        return post;
      }),
    },
  };
}

function makeService() {
  const prisma = makePrismaMock() as any;
  return { service: new CommunityService(prisma), prisma };
}

describe('CommunityService', () => {
  it('cria um topico e retorna o detalhe formatado', async () => {
    const { service } = makeService();
    const thread = await service.createThread('u-1', {
      title: 'Dúvida de matemática',
      body: 'Como resolvo f(x)?',
      questionId: 'q-1',
    });
    expect(thread.title).toBe('Dúvida de matemática');
    expect(thread.author).toEqual({ id: 'u-1', name: 'Autor' });
    expect(thread.questionId).toBe('q-1');
    expect(thread.posts).toEqual([]);
  });

  it('ignora questionId inexistente ao criar topico', async () => {
    const { service } = makeService();
    const thread = await service.createThread('u-1', {
      title: 'Sem questão',
      body: 'Olá',
      questionId: 'inexistente',
    });
    expect(thread.questionId).toBeNull();
  });

  it('lista topicos com contagem de respostas e autor', async () => {
    const { service } = makeService();
    const t = await service.createThread('u-1', {
      title: 'Topico',
      body: 'corpo',
    });
    await service.addPost('u-2', t.id, { body: 'resposta' });
    const list = await service.listThreads();
    expect(list[0].replies).toBe(1);
    expect(list[0].author).toEqual({ id: 'u-1', name: 'Autor' });
  });

  it('detalha topico com posts', async () => {
    const { service } = makeService();
    const t = await service.createThread('u-1', {
      title: 'Topico',
      body: 'corpo',
    });
    await service.addPost('u-2', t.id, { body: 'resposta' });
    const detail = await service.getThread(t.id);
    expect(detail.posts).toHaveLength(1);
    expect(detail.posts[0].body).toBe('resposta');
    expect(detail.posts[0].author.name).toBe('Replyer');
  });

  it('usa "Estudante" quando perfil sem displayName', async () => {
    const prisma = makePrismaMock();
    // Insere manualmente um topico cujo autor nao tem displayName.
    prisma.threads.set('manual', {
      id: 'manual',
      title: 't',
      body: 'b',
      createdAt: new Date(),
      questionId: null,
      user: { id: 'u-1', profile: null },
      posts: [],
    });
    const service = new CommunityService(prisma as any);
    const t = await service.getThread('manual');
    expect(t.author).toEqual({ id: 'u-1', name: 'Estudante' });
  });

  it('lanca NotFound ao detalhar topico inexistente', async () => {
    const { service } = makeService();
    await expect(service.getThread('inexistente')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lanca NotFound ao responder topico inexistente', async () => {
    const { service } = makeService();
    await expect(
      service.addPost('u-1', 'inexistente', { body: 'oi' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});