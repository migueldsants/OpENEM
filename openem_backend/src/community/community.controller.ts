import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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

  @Post()
  @ApiOperation({ summary: 'Cria um tópico no fórum' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateThreadDto) {
    return this.community.createThread(user.userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha um tópico com suas respostas' })
  get(@Param('id') id: string) {
    return this.community.getThread(id);
  }

  @Post(':id/posts')
  @ApiOperation({ summary: 'Responde a um tópico' })
  reply(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreatePostDto,
  ) {
    return this.community.addPost(user.userId, id, dto);
  }
}
