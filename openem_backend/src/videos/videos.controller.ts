import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  AddVideoNoteDto,
  CreateVideoDto,
  UpdateVideoDto,
} from './dto/video.dto';
import { VideosService } from './videos.service';

@ApiTags('videos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Get()
  @ApiOperation({ summary: 'Biblioteca de vídeos do usuário (issue #37)' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('subjectId') subjectId?: string,
  ) {
    return this.videosService.list(user.userId, subjectId || undefined);
  }

  @Post()
  @ApiOperation({
    summary: 'Salva um vídeo por link do YouTube (metadados via oEmbed)',
  })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateVideoDto) {
    return this.videosService.create(user.userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Re-classifica a matéria (ou limpa com null)' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateVideoDto,
  ) {
    return this.videosService.updateSubject(
      user.userId,
      id,
      dto.subjectId ?? null,
    );
  }

  @Post(':id/watched')
  @ApiOperation({ summary: 'Marca/desmarca como assistido (toggle)' })
  toggleWatched(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.videosService.toggleWatched(user.userId, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove o vídeo e suas notas' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.videosService.remove(user.userId, id);
  }

  @Get(':id/notes')
  @ApiOperation({ summary: 'Notas do vídeo com timestamp' })
  listNotes(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.videosService.listNotes(user.userId, id);
  }

  @Post(':id/notes')
  @ApiOperation({ summary: 'Adiciona uma nota com timestamp' })
  addNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddVideoNoteDto,
  ) {
    return this.videosService.addNote(user.userId, id, dto);
  }

  @Delete('notes/:noteId')
  @ApiOperation({ summary: 'Remove uma nota própria' })
  removeNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('noteId') noteId: string,
  ) {
    return this.videosService.removeNote(user.userId, noteId);
  }
}
