import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommunityService } from './community.service';
import { POSTS_PAGE_DEFAULT, POSTS_PAGE_MAX } from './posts-page';

// Tipos mínimos para os mocks do Prisma (mantém o teste legível sem depender do
// tipo completo do PrismaService).
type Author = { id: string; profile: { displayName: string | null } | null };
type ThreadRow = {
  id: string;
  title: string;
  body: string;
  createdAt: Date;
  questionId: string | null;
  user: Author;
};
type PostRow = {
  id: string;
  threadId: string;
  body: string;
  createdAt: Date;
  user: Author;
};
// Formato do `where` que o serviço monta para a página (ver posts-page.ts).
type PostWhere = {
  threadId: string;
  OR?: { createdAt: Date | { gt: Date }; id?: { gt: string } }[];
};

function afterCursor(post: PostRow, where: PostWhere) {
  if (!where.OR) return true;
  return where.OR.some((c) =>
    c.createdAt instanceof Date
      ? post.createdAt.getTime() === c.createdAt.getTime() && post.id > c.id!.gt
      : post.createdAt.getTime() > c.createdAt.gt.getTime(),
  );
}

function byCreation(a: PostRow, b: PostRow) {
  const d = a.createdAt.getTime() - b.createdAt.getTime();
  if (d !== 0) return d;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function makePrismaMock() {
  const threads = new Map<string, ThreadRow>();
  const posts = new Map<string, PostRow>();
  const likes = new Map<
    string,
    { id: string; postId: string; userId: string }
  >();
  let idCounter = 0;
  // Ids com zeros à esquerda: a ordem de texto é a de criação.
  const nextId = () => `id-${String(++idCounter).padStart(5, '0')}`;
  const postsOf = (threadId: string) =>
    Array.from(posts.values()).filter((p) => p.threadId === threadId);
  const likesOf = (postId: string) =>
    Array.from(likes.values()).filter((l) => l.postId === postId);

  /** Insere uma resposta direto no "banco", com data escolhida pelo teste. */
  function seedPost(threadId: string, body: string, createdAt = new Date()) {
    const post: PostRow = {
      id: nextId(),
      threadId,
      body,
      createdAt,
      user: { id: 'u-seed', profile: { displayName: 'Replyer' } },
    };
    posts.set(post.id, post);
    return post;
  }

  return {
    threads,
    posts,
    likes,
    seedPost,
    question: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(where.id.startsWith('q-') ? { id: where.id } : null),
      ),
    },
    forumThread: {
      create: jest.fn(({ data }: { data: any }) => {
        const id = nextId();
        threads.set(id, {
          id,
          title: data.title,
          body: data.body,
          createdAt: new Date(),
          questionId: data.questionId ?? null,
          user: { id: data.userId, profile: { displayName: 'Autor' } },
        });
        return Promise.resolve({ id });
      }),
      findMany: jest.fn(() =>
        Promise.resolve(
          Array.from(threads.values()).map((t) => ({
            ...t,
            _count: { posts: postsOf(t.id).length },
          })),
        ),
      ),
      findUnique: jest.fn(({ where }: { where: { id: string } }) => {
        const t = threads.get(where.id);
        return Promise.resolve(
          t ? { ...t, _count: { posts: postsOf(t.id).length } } : null,
        );
      }),
    },
    forumPost: {
      create: jest.fn(({ data }: { data: any }) => {
        const post: PostRow = {
          id: nextId(),
          threadId: data.threadId,
          body: data.body,
          createdAt: new Date(),
          user: { id: data.userId, profile: { displayName: 'Replyer' } },
        };
        posts.set(post.id, post);
        return Promise.resolve({
          id: post.id,
          body: post.body,
          createdAt: post.createdAt,
          user: post.user,
        });
      }),
      findMany: jest.fn(
        ({
          where,
          take,
          select,
        }: {
          where: PostWhere;
          take: number;
          select: { likes: false | { where: { userId: string } } };
        }) =>
          Promise.resolve(
            postsOf(where.threadId)
              .filter((p) => afterCursor(p, where))
              .sort(byCreation)
              .slice(0, take)
              .map((p) => ({
                id: p.id,
                body: p.body,
                createdAt: p.createdAt,
                user: p.user,
                _count: { likes: likesOf(p.id).length },
                ...(select.likes
                  ? {
                      likes: likesOf(p.id)
                        .filter(
                          (l) =>
                            select.likes &&
                            l.userId === select.likes.where.userId,
                        )
                        .map((l) => ({ id: l.id })),
                    }
                  : {}),
              })),
          ),
      ),
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(posts.get(where.id) ?? null),
      ),
    },
    forumPostLike: {
      findUnique: jest.fn(
        ({
          where,
        }: {
          where: { postId_userId: { postId: string; userId: string } };
        }) =>
          Promise.resolve(
            Array.from(likes.values()).find(
              (l) =>
                l.postId === where.postId_userId.postId &&
                l.userId === where.postId_userId.userId,
            ) ?? null,
          ),
      ),
      create: jest.fn(({ data }: { data: any }) => {
        const like = { id: nextId(), postId: data.postId, userId: data.userId };
        likes.set(like.id, like);
        return Promise.resolve(like);
      }),
      delete: jest.fn(({ where }: { where: { id: string } }) => {
        likes.delete(where.id);
        return Promise.resolve({ id: where.id });
      }),
      count: jest.fn(({ where }: { where: { postId: string } }) =>
        Promise.resolve(likesOf(where.postId).length),
      ),
    },
  };
}

function makeService() {
  const prisma = makePrismaMock();
  return { service: new CommunityService(prisma as any), prisma };
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
    expect(thread.replies).toBe(0);
    expect(thread.nextCursor).toBeNull();
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
    expect(detail.replies).toBe(1);
    expect(detail.nextCursor).toBeNull();
  });

  it('responder devolve só a resposta criada, não o tópico', async () => {
    const { service, prisma } = makeService();
    const t = await service.createThread('u-1', {
      title: 'Topico',
      body: 'corpo',
    });
    for (let i = 0; i < 30; i++) prisma.seedPost(t.id, `antiga ${i}`);
    prisma.forumPost.findMany.mockClear();

    const post = await service.addPost('u-2', t.id, { body: 'nova' });
    expect(post).toEqual({
      id: expect.any(String),
      body: 'nova',
      createdAt: expect.any(Date),
      author: { id: 'u-2', name: 'Replyer' },
      likes: 0,
      liked: false,
    });
    expect(post).not.toHaveProperty('posts');
    // Nenhuma leitura das respostas do tópico ao responder.
    expect(prisma.forumPost.findMany).not.toHaveBeenCalled();
  });

  it('tópico com 500 respostas: o detalhe traz uma página e o total', async () => {
    const { service, prisma } = makeService();
    const t = await service.createThread('u-1', {
      title: 'Topico cheio',
      body: 'corpo',
    });
    // Dez respostas por instante: o desempate pelo id tem de segurar a ordem.
    const base = Date.UTC(2026, 9, 16);
    const seeded = Array.from({ length: 500 }, (_, i) =>
      prisma.seedPost(t.id, `r${i}`, new Date(base + Math.floor(i / 10))),
    );

    const detail = await service.getThread(t.id, 'u-2');
    expect(detail.replies).toBe(500);
    expect(detail.posts).toHaveLength(POSTS_PAGE_DEFAULT);
    expect(detail.posts.map((p) => p.id)).toEqual(
      seeded.slice(0, POSTS_PAGE_DEFAULT).map((p) => p.id),
    );
    expect(detail.nextCursor).toEqual(expect.any(String));

    // Percorre o resto com a página máxima: cada resposta aparece uma vez, na
    // ordem de criação, e nenhuma consulta pede mais que uma página (+1).
    const ids = detail.posts.map((p) => p.id);
    let cursor = detail.nextCursor;
    let pages = 0;
    while (cursor) {
      const page = await service.listPosts(t.id, 'u-2', {
        cursor,
        limit: POSTS_PAGE_MAX,
      });
      expect(page.posts.length).toBeLessThanOrEqual(POSTS_PAGE_MAX);
      ids.push(...page.posts.map((p) => p.id));
      cursor = page.nextCursor;
      pages++;
    }
    expect(pages).toBe(10);
    expect(ids).toEqual(seeded.map((p) => p.id));
    for (const [args] of prisma.forumPost.findMany.mock.calls) {
      expect(args.take).toBeLessThanOrEqual(POSTS_PAGE_MAX + 1);
    }
  });

  it('a página seguinte não repete nem pula respostas criadas no mesmo instante', async () => {
    const { service, prisma } = makeService();
    const t = await service.createThread('u-1', { title: 'Empate', body: 'b' });
    const at = new Date('2026-10-16T10:00:00.000Z');
    const seeded = Array.from({ length: 5 }, (_, i) =>
      prisma.seedPost(t.id, `r${i}`, at),
    );
    const first = await service.listPosts(t.id, 'u-1', { limit: 2 });
    const second = await service.listPosts(t.id, 'u-1', {
      cursor: first.nextCursor!,
      limit: 2,
    });
    const third = await service.listPosts(t.id, 'u-1', {
      cursor: second.nextCursor!,
      limit: 2,
    });
    expect(
      [...first.posts, ...second.posts, ...third.posts].map((p) => p.id),
    ).toEqual(seeded.map((p) => p.id));
    expect(third.nextCursor).toBeNull();
  });

  it('recusa cursor malformado com 400', async () => {
    const { service } = makeService();
    const t = await service.createThread('u-1', { title: 'Topico', body: 'b' });
    await expect(
      service.listPosts(t.id, 'u-1', { cursor: 'nao-e-um-cursor' }),
    ).rejects.toBeInstanceOf(BadRequestException);
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

  it('lanca NotFound ao paginar respostas de topico inexistente', async () => {
    const { service } = makeService();
    await expect(
      service.listPosts('inexistente', 'u-1', {}),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lanca NotFound ao responder topico inexistente', async () => {
    const { service } = makeService();
    await expect(
      service.addPost('u-1', 'inexistente', { body: 'oi' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('toggle like: curtir, descurtir e 404 para post inexistente', async () => {
    const { service } = makeService();
    const t = await service.createThread('u-1', {
      title: 'Like',
      body: 'corpo',
    });
    const { id: postId } = await service.addPost('u-2', t.id, {
      body: 'resposta',
    });

    // curte como u-3
    const liked = await service.toggleLike('u-3', t.id, postId);
    expect(liked.liked).toBe(true);
    expect(liked.likes).toBe(1);
    // getThread reflete like do u-3, e só para ele
    const after = await service.getThread(t.id, 'u-3');
    expect(after.posts[0].likes).toBe(1);
    expect(after.posts[0].liked).toBe(true);
    const other = await service.getThread(t.id, 'u-4');
    expect(other.posts[0].likes).toBe(1);
    expect(other.posts[0].liked).toBe(false);

    // descurte como u-3
    const unliked = await service.toggleLike('u-3', t.id, postId);
    expect(unliked.liked).toBe(false);
    expect(unliked.likes).toBe(0);

    // post inexistente -> 404
    await expect(
      service.toggleLike('u-3', t.id, 'inexistente'),
    ).rejects.toBeInstanceOf(NotFoundException);
    // post de outro tópico -> 404
    await expect(
      service.toggleLike('u-3', 'outro-thread', postId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
