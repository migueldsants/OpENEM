import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateThreadDto } from './dto/create-thread.dto';
import { ListPostsDto } from './dto/list-posts.dto';
import { ReportDto } from './dto/report.dto';
import {
  afterCursor,
  clampPageSize,
  decodePostCursor,
  type PostCursor,
  slicePage,
} from './posts-page';

// Autor exibido publicamente — nome de exibição, sem expor o e-mail.
const AUTHOR_SELECT = {
  select: {
    id: true,
    profile: { select: { displayName: true } },
  },
} as const;

function authorName(user: {
  id: string;
  profile: { displayName: string | null } | null;
}) {
  return { id: user.id, name: user.profile?.displayName ?? 'Estudante' };
}

@Injectable()
export class CommunityService {
  constructor(private readonly prisma: PrismaService) {}

  async createThread(userId: string, dto: CreateThreadDto) {
    // Ignora questionId inexistente em vez de falhar (vínculo é opcional).
    let questionId: string | null = null;
    if (dto.questionId) {
      const q = await this.prisma.question.findUnique({
        where: { id: dto.questionId },
        select: { id: true },
      });
      questionId = q?.id ?? null;
    }
    const thread = await this.prisma.forumThread.create({
      data: { userId, title: dto.title, body: dto.body, questionId },
      select: { id: true },
    });
    return this.getThread(thread.id, userId);
  }

  async listThreads() {
    const threads = await this.prisma.forumThread.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        title: true,
        createdAt: true,
        questionId: true,
        user: AUTHOR_SELECT,
        _count: { select: { posts: true } },
      },
    });
    return threads.map((t) => ({
      id: t.id,
      title: t.title,
      createdAt: t.createdAt,
      questionId: t.questionId,
      author: authorName(t.user),
      replies: t._count.posts,
    }));
  }

  /**
   * Detalha o tópico com a primeira página de respostas. `replies` é o total;
   * as páginas seguintes vêm de `listPosts` com o `nextCursor`.
   */
  async getThread(id: string, currentUserId?: string) {
    const [thread, page] = await Promise.all([
      this.prisma.forumThread.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          body: true,
          createdAt: true,
          questionId: true,
          user: AUTHOR_SELECT,
          _count: { select: { posts: true } },
        },
      }),
      this.postPage(id, currentUserId, {}),
    ]);
    if (!thread) {
      throw new NotFoundException('Tópico não encontrado');
    }
    return {
      id: thread.id,
      title: thread.title,
      body: thread.body,
      createdAt: thread.createdAt,
      questionId: thread.questionId,
      author: authorName(thread.user),
      replies: thread._count.posts,
      posts: page.posts,
      nextCursor: page.nextCursor,
    };
  }

  /** Próxima página de respostas de um tópico (ordem de criação). */
  async listPosts(
    threadId: string,
    currentUserId: string,
    query: ListPostsDto,
  ) {
    await this.ensureThread(threadId);
    return this.postPage(threadId, currentUserId, query);
  }

  /** Grava a resposta e devolve só ela, no formato das respostas da página. */
  async addPost(userId: string, threadId: string, dto: CreatePostDto) {
    await this.ensureThread(threadId);
    const post = await this.prisma.forumPost.create({
      data: { threadId, userId, body: dto.body },
      select: { id: true, body: true, createdAt: true, user: AUTHOR_SELECT },
    });
    return {
      id: post.id,
      body: post.body,
      createdAt: post.createdAt,
      author: authorName(post.user),
      likes: 0,
      liked: false,
    };
  }

  /**
   * Apaga um tópico do próprio aluno, com as respostas de todos. Tópico de
   * outro aluno responde 404, igual ao que não existe.
   */
  async deleteThread(userId: string, id: string) {
    const { count } = await this.prisma.forumThread.deleteMany({
      where: { id, userId },
    });
    if (count === 0) {
      throw new NotFoundException('Tópico não encontrado');
    }
    return { removed: true };
  }

  /** Apaga uma resposta do próprio aluno; a de outro aluno responde 404. */
  async deletePost(userId: string, threadId: string, postId: string) {
    const { count } = await this.prisma.forumPost.deleteMany({
      where: { id: postId, threadId, userId },
    });
    if (count === 0) {
      throw new NotFoundException('Resposta não encontrada');
    }
    return { removed: true };
  }

  /**
   * Denuncia um tópico (`postId` nulo) ou uma resposta. Fica gravada em
   * ForumReport para quem modera a instalação; denunciar de novo o mesmo alvo
   * só troca o motivo. O próprio autor não denuncia: ele pode apagar.
   */
  async report(
    userId: string,
    threadId: string,
    postId: string | null,
    dto: ReportDto,
  ) {
    const authorId = postId
      ? await this.postAuthor(threadId, postId)
      : await this.threadAuthor(threadId);
    if (authorId === userId) {
      throw new BadRequestException(
        'Não dá para denunciar o que você mesmo escreveu',
      );
    }
    const existing = await this.prisma.forumReport.findFirst({
      where: { reporterId: userId, threadId, postId },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.forumReport.update({
        where: { id: existing.id },
        data: { reason: dto.reason },
      });
    } else {
      await this.prisma.forumReport.create({
        data: { reporterId: userId, threadId, postId, reason: dto.reason },
      });
    }
    return { reported: true };
  }

  private async threadAuthor(threadId: string): Promise<string> {
    const thread = await this.prisma.forumThread.findUnique({
      where: { id: threadId },
      select: { userId: true },
    });
    if (!thread) {
      throw new NotFoundException('Tópico não encontrado');
    }
    return thread.userId;
  }

  private async postAuthor(threadId: string, postId: string): Promise<string> {
    const post = await this.prisma.forumPost.findUnique({
      where: { id: postId },
      select: { threadId: true, userId: true },
    });
    if (!post || post.threadId !== threadId) {
      throw new NotFoundException('Resposta não encontrada');
    }
    return post.userId;
  }

  private async ensureThread(id: string) {
    const thread = await this.prisma.forumThread.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!thread) {
      throw new NotFoundException('Tópico não encontrado');
    }
  }

  private async postPage(
    threadId: string,
    currentUserId: string | undefined,
    query: ListPostsDto,
  ) {
    let after: PostCursor | null = null;
    if (query.cursor) {
      after = decodePostCursor(query.cursor);
      if (!after) {
        throw new BadRequestException('Cursor inválido');
      }
    }
    const limit = clampPageSize(query.limit);
    const rows = await this.prisma.forumPost.findMany({
      where: { threadId, ...(after ? afterCursor(after) : {}) },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      select: {
        id: true,
        body: true,
        createdAt: true,
        user: AUTHOR_SELECT,
        _count: { select: { likes: true } },
        likes: currentUserId
          ? { where: { userId: currentUserId }, select: { id: true } }
          : false,
      },
    });
    const { items, nextCursor } = slicePage(rows, limit);
    return {
      posts: items.map((p) => ({
        id: p.id,
        body: p.body,
        createdAt: p.createdAt,
        author: authorName(p.user),
        likes: p._count.likes,
        liked:
          currentUserId && Array.isArray(p.likes) ? p.likes.length > 0 : false,
      })),
      nextCursor,
    };
  }

  /**
   * Alterna (toggle) o like de um usuário em uma resposta do fórum (issue #19).
   * Retorna o estado resultante: { liked, likes }. Lança 404 se o post não
   * existe (ou pertence a um tópico diferente do informado na rota — mantém o
   * path RESTful coerente com o resource do like).
   */
  async toggleLike(
    userId: string,
    threadId: string,
    postId: string,
  ): Promise<{ liked: boolean; likes: number }> {
    const post = await this.prisma.forumPost.findUnique({
      where: { id: postId },
      select: { id: true, threadId: true },
    });
    if (!post || post.threadId !== threadId) {
      throw new NotFoundException('Resposta não encontrada');
    }
    const existing = await this.prisma.forumPostLike.findUnique({
      where: { postId_userId: { postId, userId } },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.forumPostLike.delete({ where: { id: existing.id } });
      const likes = await this.prisma.forumPostLike.count({
        where: { postId },
      });
      return { liked: false, likes };
    }
    await this.prisma.forumPostLike.create({ data: { postId, userId } });
    const likes = await this.prisma.forumPostLike.count({
      where: { postId },
    });
    return { liked: true, likes };
  }
}
