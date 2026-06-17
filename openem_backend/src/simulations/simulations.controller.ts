import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FinishSimulationDto } from './dto/finish-simulation.dto';
import { StartSimulationDto } from './dto/start-simulation.dto';
import { SimulationsService } from './simulations.service';

@ApiTags('simulations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('simulations')
export class SimulationsController {
  constructor(private readonly simulationsService: SimulationsService) {}

  @Post()
  @ApiOperation({ summary: 'Inicia um simulado a partir de um template' })
  start(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: StartSimulationDto,
  ) {
    return this.simulationsService.start(user.userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Estado de um simulado' })
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.simulationsService.get(user.userId, id);
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
