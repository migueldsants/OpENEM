import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { TooManyAttemptsException } from '../rate-limit/login-attempts.service';
import { AuthResult, AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

// Rate limiting dos endpoints de autenticação (issues #49 e #87), por IP:
// - register: argon2 por pedido (DoS) e criação de contas em massa. 20/min
//   cabem uma turma inteira criando conta na mesma rede.
// - login: 30/min por IP, folgado para a sala de aula atrás de NAT. Quem
//   ataca uma conta trocando de IP esbarra no limite por conta
//   (LoginAttemptsService: 5 senhas erradas em 15 min bloqueiam a conta).
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: 'Cria uma conta e retorna um token de acesso' })
  register(@Body() dto: RegisterDto): Promise<AuthResult> {
    return this.authService.register(dto);
  }

  @Post('login')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Autentica e retorna um token de acesso' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResult> {
    try {
      return await this.authService.login(dto);
    } catch (err) {
      // Conta bloqueada: o mesmo Retry-After do 429 do throttler.
      if (err instanceof TooManyAttemptsException) {
        res.header('Retry-After', String(err.retryAfterSec));
      }
      throw err;
    }
  }
}
