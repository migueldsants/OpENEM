import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AnswersService } from './answers.service';
import { CreateAnswerDto } from './dto/create-answer.dto';

@ApiTags('answers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('answers')
export class AnswersController {
  constructor(private readonly answersService: AnswersService) {}

  @Post()
  @ApiOperation({
    summary: 'Registra uma tentativa e retorna a correção comentada',
  })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAnswerDto) {
    return this.answersService.create(user.userId, dto);
  }
}
