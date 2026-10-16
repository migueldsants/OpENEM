import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CommunityService } from './community.service';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateThreadDto } from './dto/create-thread.dto';

@ApiTags('community')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('community/threads')
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista os tópicos do fórum (mais recentes primeiro)',
  })
  list() {
    return this.community.listThreads();
  }

  // Escrita no fórum cresce o tópico e a leitura dele (ver pendências no PR:
  // as respostas ainda não são paginadas). Dez por minuto por IP segura o ritmo.
  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Cria um tópico no fórum' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateThreadDto) {
    return this.community.createThread(user.userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha um tópico com suas respostas' })
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.community.getThread(id, user.userId);
  }

  @Post(':id/posts')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Responde a um tópico' })
  reply(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreatePostDto,
  ) {
    return this.community.addPost(user.userId, id, dto);
  }

  @Post(':id/posts/:postId/like')
  @ApiOperation({ summary: 'Curtir/descurtir uma resposta do fórum (toggle)' })
  toggleLike(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('postId') postId: string,
  ) {
    return this.community.toggleLike(user.userId, id, postId);
  }
}
