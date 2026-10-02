import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ToolsService } from './tools.service';

@ApiTags('tools')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tools')
export class ToolsController {
  constructor(private readonly toolsService: ToolsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Ferramentas abertas no GitHub, com a contagem de estrelas (cache de 1 hora)',
  })
  list() {
    return this.toolsService.list();
  }
}
