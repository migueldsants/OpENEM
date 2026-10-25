import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CommunityService } from './community.service';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateThreadDto } from './dto/create-thread.dto';
import { ListPostsDto } from './dto/list-posts.dto';
import { ReportDto } from './dto/report.dto';

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
  @ApiOperation({
    summary: 'Detalha um tópico com a primeira página de respostas',
  })
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

  @Get(':id/posts')
  @ApiOperation({
    summary: 'Próxima página de respostas de um tópico (cursor)',
  })
  listPosts(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query() query: ListPostsDto,
  ) {
    return this.community.listPosts(id, user.userId, query);
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

  @Delete(':id')
  @ApiOperation({
    summary: 'Apaga um tópico próprio, com as respostas (o de outro aluno é 404)',
  })
  removeThread(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.community.deleteThread(user.userId, id);
  }

  @Delete(':id/posts/:postId')
  @ApiOperation({
    summary: 'Apaga uma resposta própria (a de outro aluno é 404)',
  })
  removePost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('postId') postId: string,
  ) {
    return this.community.deletePost(user.userId, id, postId);
  }

  // Denúncia: o mesmo ritmo da escrita no fórum, para ninguém soterrar a
  // moderação de denúncias.
  @Post(':id/report')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Denuncia um tópico do fórum' })
  reportThread(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReportDto,
  ) {
    return this.community.report(user.userId, id, null, dto);
  }

  @Post(':id/posts/:postId/report')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Denuncia uma resposta do fórum' })
  reportPost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('postId') postId: string,
    @Body() dto: ReportDto,
  ) {
    return this.community.report(user.userId, id, postId, dto);
  }
}
