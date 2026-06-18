import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { FavoritesService } from './favorites.service';

@ApiTags('favorites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Post()
  @ApiOperation({ summary: 'Favorita uma questão' })
  add(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFavoriteDto) {
    return this.favoritesService.add(user.userId, dto.questionId);
  }

  @Get()
  @ApiOperation({ summary: 'Lista as questões favoritadas do usuário' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.favoritesService.list(user.userId);
  }

  @Delete(':questionId')
  @ApiOperation({ summary: 'Remove uma questão dos favoritos' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('questionId') questionId: string,
  ) {
    return this.favoritesService.remove(user.userId, questionId);
  }
}
