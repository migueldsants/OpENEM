import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GradeReviewDto } from './dto/grade-review.dto';
import { ReviewService } from './review.service';

@ApiTags('review')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('review')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Get('queue')
  @ApiOperation({ summary: 'Fila de revisão (assuntos com revisão vencida)' })
  queue(@CurrentUser() user: AuthenticatedUser) {
    return this.reviewService.queue(user.userId);
  }

  @Post(':id')
  @ApiOperation({
    summary: 'Reagenda um item de revisão pela lembrança (0..5)',
  })
  grade(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: GradeReviewDto,
  ) {
    return this.reviewService.grade(user.userId, id, dto.quality);
  }
}
