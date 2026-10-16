import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PDF_THROTTLE } from '../common/pdf/pdf-render.service';
import { CreateFormulaDto } from './dto/create-formula.dto';
import { FormulasPdfDto } from './dto/formulas-pdf.dto';
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

  @Post('pdf')
  @HttpCode(200)
  @Throttle(PDF_THROTTLE)
  @ApiOperation({
    summary:
      'Caderno de fórmulas em PDF: capa, sumário, fórmulas desenhadas do LaTeX e legenda',
  })
  @Header('Content-Type', 'application/pdf')
  async pdf(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: FormulasPdfDto,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.formulasService.pdf(
      user.userId,
      dto,
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
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
