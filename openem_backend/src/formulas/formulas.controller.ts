import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateFormulaDto } from './dto/create-formula.dto';
import { QueryFormulasDto } from './dto/query-formulas.dto';
import { FormulasService } from './formulas.service';

@ApiTags('formulas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('formulas')
export class FormulasController {
  constructor(private readonly formulasService: FormulasService) {}

  @Get()
  @ApiOperation({
    summary:
      'Cheat sheet de fórmulas com busca por texto, filtro por matéria/assunto e favoritas (issue #38)',
  })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryFormulasDto,
  ) {
    return this.formulasService.list(user.userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe de uma fórmula com estado de favorito' })
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.formulasService.get(user.userId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Cria uma fórmula personalizada' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFormulaDto,
  ) {
    return this.formulasService.create(user.userId, dto);
  }

  @Post(':id/favorite')
  @ApiOperation({ summary: 'Favorita/desfavorita uma fórmula (toggle)' })
  toggleFavorite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.formulasService.toggleFavorite(user.userId, id);
  }
}
