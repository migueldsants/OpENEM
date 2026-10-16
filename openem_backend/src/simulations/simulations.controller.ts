import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PDF_THROTTLE } from '../common/pdf/pdf-render.service';
import { PDF_THEMES } from '../common/pdf/themes';
import { FinishSimulationDto } from './dto/finish-simulation.dto';
import { SimulationPdfDto } from './dto/simulation-pdf.dto';
import {
  CreateTemplateDto,
  SimulationFiltersDto,
  StartSimulationDto,
} from './dto/start-simulation.dto';
import { SimulationPdfService } from './simulation-pdf.service';
import { SimulationsService } from './simulations.service';

@ApiTags('simulations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('simulations')
export class SimulationsController {
  constructor(
    private readonly simulationsService: SimulationsService,
    private readonly pdfService: SimulationPdfService,
  ) {}

  @Get('templates')
  @ApiOperation({
    summary: 'Lista os simulados disponíveis e os que o aluno salvou',
  })
  templates(@CurrentUser() user: AuthenticatedUser) {
    return this.simulationsService.listTemplates(user.userId);
  }

  @Post('templates')
  @ApiOperation({ summary: 'Salva um simulado personalizado (por tema)' })
  createTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTemplateDto,
  ) {
    return this.simulationsService.createTemplate(user.userId, dto);
  }

  @Delete('templates/:id')
  @ApiOperation({ summary: 'Remove um simulado personalizado do aluno' })
  deleteTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.simulationsService.deleteTemplate(user.userId, id);
  }

  @Post('preview')
  @ApiOperation({
    summary: 'Quantas questões existem para um recorte, antes de iniciar',
  })
  preview(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SimulationFiltersDto,
  ) {
    return this.simulationsService.preview(user.userId, dto);
  }

  @Get('pdf-themes')
  @ApiOperation({ summary: 'Temas de cor disponíveis para o caderno em PDF' })
  pdfThemes() {
    return PDF_THEMES.map((t) => ({
      key: t.key,
      label: t.label,
      brand: t.brand,
      surface: t.surface,
    }));
  }

  @Post()
  @ApiOperation({
    summary: 'Inicia um simulado (de um template ou por filtros)',
  })
  start(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: StartSimulationDto,
  ) {
    return this.simulationsService.start(user.userId, dto);
  }

  @Post('pdf')
  @Throttle(PDF_THROTTLE)
  @ApiOperation({
    summary:
      'Gera o caderno de prova em PDF no padrão ENEM, com a capa do OpENEM',
  })
  @Header('Content-Type', 'application/pdf')
  async pdf(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SimulationPdfDto,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.pdfService.generate(
      user.userId,
      dto,
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Estado de um simulado' })
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.simulationsService.get(user.userId, id);
  }

  @Post(':id/pdf')
  @Throttle(PDF_THROTTLE)
  @ApiOperation({ summary: 'Gera o PDF de um simulado que o aluno já fez' })
  @Header('Content-Type', 'application/pdf')
  async simulationPdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SimulationPdfDto,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.pdfService.generate(
      user.userId,
      dto,
      id,
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }

  @Post(':id/finish')
  @ApiOperation({ summary: 'Finaliza e corrige um simulado' })
  finish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: FinishSimulationDto,
  ) {
    return this.simulationsService.finish(user.userId, id, dto);
  }
}
