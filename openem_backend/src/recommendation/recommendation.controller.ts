import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RecommendationService } from './recommendation.service';

@ApiTags('recommendation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('recommendation')
export class RecommendationController {
  constructor(private readonly recommendation: RecommendationService) {}

  @Get('next')
  @ApiOperation({
    summary: 'Questões recomendadas a partir dos assuntos com mais erros',
  })
  next(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit', new DefaultValuePipe(5), ParseIntPipe) limit: number,
  ) {
    return this.recommendation.next(
      user.userId,
      Math.min(Math.max(limit, 1), 20),
    );
  }
}
