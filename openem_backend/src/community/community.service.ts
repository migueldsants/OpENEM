import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateThreadDto } from './dto/create-thread.dto';

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
    return this.getThread(thread.id);
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

  async getThread(id: string) {
    const thread = await this.prisma.forumThread.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        body: true,
        createdAt: true,
        questionId: true,
        user: AUTHOR_SELECT,
        posts: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            body: true,
            createdAt: true,
            user: AUTHOR_SELECT,
          },
        },
      },
    });
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
      posts: thread.posts.map((p) => ({
        id: p.id,
        body: p.body,
        createdAt: p.createdAt,
        author: authorName(p.user),
      })),
    };
  }

  async addPost(userId: string, threadId: string, dto: CreatePostDto) {
    const thread = await this.prisma.forumThread.findUnique({
      where: { id: threadId },
      select: { id: true },
    });
    if (!thread) {
      throw new NotFoundException('Tópico não encontrado');
    }
    await this.prisma.forumPost.create({
      data: { threadId, userId, body: dto.body },
    });
    return this.getThread(threadId);
  }
}
