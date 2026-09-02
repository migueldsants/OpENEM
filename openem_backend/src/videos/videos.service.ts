import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddVideoNoteDto, CreateVideoDto } from './dto/video.dto';
import { extractYouTubeId, fetchYouTubeMetadata } from './youtube-oembed';

export interface VideoView {
  id: string;
  youtubeId: string;
  title: string;
  thumbnail: string | null;
  subjectId: string | null;
  subjectName: string | null;
  watched: boolean;
  createdAt: Date;
  notes: {
    id: string;
    timestampSec: number;
    content: string;
    createdAt: Date;
  }[];
}

const VIDEO_INCLUDE = {
  subject: { select: { name: true } },
  notes: {
    orderBy: { timestampSec: 'asc' as const },
    select: { id: true, timestampSec: true, content: true, createdAt: true },
  },
};

type VideoRow = {
  id: string;
  youtubeId: string;
  title: string;
  thumbnail: string | null;
  subjectId: string | null;
  watched: boolean;
  createdAt: Date;
  subject: { name: string } | null;
  notes: {
    id: string;
    timestampSec: number;
    content: string;
    createdAt: Date;
  }[];
};

@Injectable()
export class VideosService {
  constructor(private readonly prisma: PrismaService) {}

  private toView(v: VideoRow): VideoView {
    return {
      id: v.id,
      youtubeId: v.youtubeId,
      title: v.title,
      thumbnail: v.thumbnail,
      subjectId: v.subjectId,
      subjectName: v.subject?.name ?? null,
      watched: v.watched,
      createdAt: v.createdAt,
      notes: v.notes,
    };
  }

  /** Biblioteca do usuário, agrupável por matéria no cliente. */
  async list(userId: string, subjectId?: string) {
    const rows = await this.prisma.video.findMany({
      where: { userId, ...(subjectId ? { subjectId } : {}) },
      orderBy: { createdAt: 'desc' },
      include: VIDEO_INCLUDE,
    });
    return rows.map((v) => this.toView(v));
  }

  /**
   * Salva um vídeo por link/ID do YouTube (issue #37). Metadados via oEmbed
   * público; falha de rede não impede o save (cai para o ID como título).
   */
  async create(userId: string, dto: CreateVideoDto) {
    const youtubeId = extractYouTubeId(dto.url);
    if (!youtubeId) {
      throw new NotFoundException('Link do YouTube inválido');
    }
    if (dto.subjectId) {
      const subject = await this.prisma.subject.findUnique({
        where: { id: dto.subjectId },
        select: { id: true },
      });
      if (!subject) throw new NotFoundException('Matéria não encontrada');
    }

    const meta = await fetchYouTubeMetadata(youtubeId);
    const video = await this.prisma.video.create({
      data: {
        userId,
        youtubeId,
        title: meta.title ?? `Vídeo ${youtubeId}`,
        thumbnail: meta.thumbnail,
        subjectId: dto.subjectId ?? null,
      },
      include: VIDEO_INCLUDE,
    });
    return this.toView(video);
  }

  /** Marca/desmarca como assistido. */
  async toggleWatched(userId: string, id: string) {
    const video = await this.prisma.video.findUnique({
      where: { id },
      select: { userId: true, watched: true },
    });
    if (!video) throw new NotFoundException('Vídeo não encontrado');
    if (video.userId !== userId) throw new ForbiddenException();

    const updated = await this.prisma.video.update({
      where: { id },
      data: { watched: !video.watched },
      include: VIDEO_INCLUDE,
    });
    return this.toView(updated);
  }

  /** Re-classifica o vídeo de matéria. */
  async updateSubject(userId: string, id: string, subjectId: string | null) {
    const video = await this.prisma.video.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!video || video.userId !== userId) {
      throw new NotFoundException('Vídeo não encontrado');
    }
    if (subjectId) {
      const subject = await this.prisma.subject.findUnique({
        where: { id: subjectId },
        select: { id: true },
      });
      if (!subject) throw new NotFoundException('Matéria não encontrada');
    }
    const updated = await this.prisma.video.update({
      where: { id },
      data: { subjectId },
      include: VIDEO_INCLUDE,
    });
    return this.toView(updated);
  }

  async remove(userId: string, id: string) {
    const video = await this.prisma.video.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!video || video.userId !== userId) {
      throw new NotFoundException('Vídeo não encontrado');
    }
    await this.prisma.video.delete({ where: { id } });
    return { removed: true };
  }

  /** Notas do vídeo (do dono), ordenadas por timestamp. */
  async listNotes(userId: string, videoId: string) {
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
      select: { userId: true },
    });
    if (!video || video.userId !== userId) {
      throw new NotFoundException('Vídeo não encontrado');
    }
    return this.prisma.videoNote.findMany({
      where: { videoId },
      orderBy: { timestampSec: 'asc' },
      select: {
        id: true,
        timestampSec: true,
        content: true,
        createdAt: true,
      },
    });
  }

  /** Adiciona uma nota com timestamp (issue #37). */
  async addNote(userId: string, videoId: string, dto: AddVideoNoteDto) {
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
      select: { userId: true },
    });
    if (!video || video.userId !== userId) {
      throw new NotFoundException('Vídeo não encontrado');
    }
    return this.prisma.videoNote.create({
      data: {
        videoId,
        userId,
        timestampSec: Math.max(0, Math.floor(dto.timestampSec)),
        content: dto.content,
      },
      select: { id: true, timestampSec: true, content: true, createdAt: true },
    });
  }

  /** Remove uma nota própria. */
  async removeNote(userId: string, noteId: string) {
    const note = await this.prisma.videoNote.findUnique({
      where: { id: noteId },
      select: { userId: true },
    });
    if (!note || note.userId !== userId) {
      throw new NotFoundException('Nota não encontrada');
    }
    await this.prisma.videoNote.delete({ where: { id: noteId } });
    return { removed: true };
  }
}
