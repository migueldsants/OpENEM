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
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateThemeDto } from './dto/create-theme.dto';
import { ListCommunityThemesDto } from './dto/list-community-themes.dto';
import { UpdateThemeDto } from './dto/update-theme.dto';
import { ThemesService } from './themes.service';

@ApiTags('themes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('themes')
export class ThemesController {
  constructor(private readonly themes: ThemesService) {}

  // Rotas estáticas antes de ':id'.
  @Get('mine')
  @ApiOperation({ summary: 'Temas de cores criados pelo aluno' })
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.themes.mine(user.userId);
  }

  @Get('community')
  @ApiOperation({
    summary: 'Temas publicados pela comunidade (populares ou recentes)',
  })
  community(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListCommunityThemesDto,
  ) {
    return this.themes.community(
      user.userId,
      query.sort,
      query.take,
      query.skip,
    );
  }

  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({
    summary: 'Cria um tema (nasce privado se isPublic não vier)',
  })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateThemeDto) {
    return this.themes.create(user.userId, dto);
  }

  @Patch(':id')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Edita, publica ou despublica um tema próprio' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateThemeDto,
  ) {
    return this.themes.update(user.userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Apaga um tema próprio' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.themes.remove(user.userId, id);
  }

  @Post(':id/like')
  @ApiOperation({ summary: 'Curtir/descurtir um tema publicado (toggle)' })
  toggleLike(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.themes.toggleLike(user.userId, id);
  }
}
