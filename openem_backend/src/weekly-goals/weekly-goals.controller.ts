import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateWeeklyGoalDto } from './dto/create-weekly-goal.dto';
import { UpdateWeeklyGoalDto } from './dto/update-weekly-goal.dto';
import { WeeklyGoalsService } from './weekly-goals.service';

@ApiTags('weekly-goals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('weekly-goals')
export class WeeklyGoalsController {
  constructor(private readonly goalsService: WeeklyGoalsService) {}

  @Get()
  @ApiOperation({
    summary: 'Metas da semana corrente com o progresso calculado (issue #44)',
  })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.goalsService.listCurrentWeek(user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Cria uma meta para a semana corrente' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWeeklyGoalDto,
  ) {
    return this.goalsService.create(user.userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza os alvos de uma meta própria' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateWeeklyGoalDto,
  ) {
    return this.goalsService.update(user.userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove uma meta própria' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.goalsService.remove(user.userId, id);
  }
}
