import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { EvaluateEssayDto } from './dto/evaluate-essay.dto';
import { EssaysService } from './essays.service';

@ApiTags('essays')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('essays')
export class EssaysController {
  constructor(private readonly essaysService: EssaysService) {}

  @Get('prompts')
  @ApiOperation({ summary: 'Lista os temas de redação disponíveis' })
  listPrompts() {
    return this.essaysService.listPrompts();
  }

  @Get('prompts/:id')
  @ApiOperation({ summary: 'Detalha um tema de redação' })
  getPrompt(@Param('id') id: string) {
    return this.essaysService.getPrompt(id);
  }

  @Post('submissions')
  @ApiOperation({ summary: 'Envia uma redação para um tema' })
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSubmissionDto,
  ) {
    return this.essaysService.submit(user.userId, dto);
  }

  @Get('submissions')
  @ApiOperation({ summary: 'Lista as redações enviadas pelo usuário' })
  listSubmissions(@CurrentUser() user: AuthenticatedUser) {
    return this.essaysService.listSubmissions(user.userId);
  }

  @Get('submissions/:id')
  @ApiOperation({ summary: 'Detalha uma redação (com a avaliação, se houver)' })
  getSubmission(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.essaysService.getSubmission(user.userId, id);
  }

  @Post('submissions/:id/evaluation')
  @ApiOperation({
    summary: 'Corrige a redação por competência (rubrica manual)',
  })
  evaluate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: EvaluateEssayDto,
  ) {
    return this.essaysService.evaluate(user.userId, id, dto);
  }

  @Get('ai-available')
  @ApiOperation({ summary: 'Indica se a correção por IA está disponível' })
  aiAvailable() {
    return this.essaysService.aiAvailable();
  }

  @Post('submissions/:id/ai-evaluation')
  @ApiOperation({ summary: 'Corrige a redação por IA (Claude)' })
  evaluateWithAi(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.essaysService.evaluateWithAi(user.userId, id);
  }
}
