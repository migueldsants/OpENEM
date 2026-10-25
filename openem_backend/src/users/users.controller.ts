import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TooManyAttemptsException } from '../rate-limit/login-attempts.service';
import { exportFilename } from './data-export';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Retorna o usuário autenticado e seu perfil' })
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getMe(user.userId);
  }

  // Lê todas as tabelas do aluno de uma vez: cinco por dez minutos bastam
  // para quem quer o arquivo, e seguram quem quer só pesar no banco.
  @Get('me/export')
  @Throttle({ default: { ttl: 600_000, limit: 5 } })
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Baixa todos os dados do aluno em JSON (LGPD, art. 18)',
  })
  exportData(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const now = new Date();
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${exportFilename(now)}"`,
    );
    return this.usersService.exportData(user.userId, now);
  }

  // A senha errada conta no limite por conta do login (5 em 15 min), além
  // deste limite por aluno.
  @Delete('me')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Exclui a conta e todos os dados do aluno, confirmando a senha atual (LGPD, art. 18)',
  })
  async deleteMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    try {
      await this.usersService.deleteAccount(user.userId, dto.password);
    } catch (err) {
      // Conta bloqueada: o mesmo Retry-After do login.
      if (err instanceof TooManyAttemptsException) {
        res.header('Retry-After', String(err.retryAfterSec));
      }
      throw err;
    }
  }

  @Get(':id/profile')
  @ApiOperation({ summary: 'Perfil público de um usuário (sem PII)' })
  getPublicProfile(@Param('id') id: string) {
    return this.usersService.getPublicProfile(id);
  }

  @Put('me/profile')
  @ApiOperation({ summary: 'Atualiza o perfil de estudo do usuário' })
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.userId, dto);
  }
}
