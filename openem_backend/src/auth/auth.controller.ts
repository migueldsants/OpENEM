import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { RESET_REQUESTED_MESSAGE } from '../common/auth-tokens';
import { GOOGLE_FLOW_TTL_MS } from '../common/google-oidc';
import { readCookie } from '../common/sealed-cookie';
import { TooManyAttemptsException } from '../rate-limit/login-attempts.service';
import { AuthResult, AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { GoogleExchangeDto } from './dto/google-exchange.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';
import { RegisterDto } from './dto/register.dto';
import {
  GOOGLE_COOKIE,
  GOOGLE_COOKIE_PATH,
  type GoogleAuthResult,
  GoogleAuthService,
} from './google-auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthenticatedUser } from './jwt.strategy';
import { PasswordResetService } from './password-reset.service';

/** Bloqueio por conta: o mesmo Retry-After do 429 do throttler. */
async function comRetryAfter<T>(res: Response, fn: () => Promise<T>) {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof TooManyAttemptsException) {
      res.header('Retry-After', String(err.retryAfterSec));
    }
    throw err;
  }
}

// Rate limiting dos endpoints de autenticação (issues #49 e #87), por IP:
// - register: argon2 por pedido (DoS) e criação de contas em massa. 20/min
//   cabem uma turma inteira criando conta na mesma rede.
// - login: 30/min por IP, folgado para a sala de aula atrás de NAT. Quem
//   ataca uma conta trocando de IP esbarra no limite por conta
//   (LoginAttemptsService: 5 senhas erradas em 15 min bloqueiam a conta).
// - forgot-password: 10 a cada 15 min por IP, e 3 links por hora por e-mail
//   (PasswordResetService): cada pedido pode mandar um e-mail.
// - reset-password, Google: 10 e 20 por minuto por IP; os tokens têm 256
//   bits, então o limite é contra abuso, não contra adivinhação.
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordReset: PasswordResetService,
    private readonly google: GoogleAuthService,
  ) {}

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
  login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResult> {
    return comRetryAfter(res, () => this.authService.login(dto));
  }

  @Get('options')
  @ApiOperation({
    summary:
      'Formas de entrar ligadas neste servidor (recuperação de senha por e-mail, Google)',
  })
  options(): { passwordReset: boolean; google: boolean } {
    return {
      passwordReset: this.passwordReset.enabled,
      google: this.google.enabled,
    };
  }

  @Post('forgot-password')
  @Throttle({ default: { ttl: 15 * 60_000, limit: 10 } })
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary:
      'Manda um link de redefinição de senha, se o e-mail tiver conta (a resposta é sempre a mesma)',
  })
  @ApiResponse({ status: 202, description: 'Pedido aceito' })
  @ApiResponse({ status: 503, description: 'SMTP não configurado' })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    await comRetryAfter(res, () => this.passwordReset.request(dto.email));
    return { message: RESET_REQUESTED_MESSAGE };
  }

  @Post('reset-password')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Cria a senha nova com o token do e-mail, encerra as outras sessões e retorna um token de acesso',
  })
  resetPassword(@Body() dto: ResetPasswordDto): Promise<AuthResult> {
    return this.passwordReset.reset(dto.token, dto.password);
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Sai de todos os dispositivos: nenhum token emitido até agora vale mais',
  })
  async logoutAll(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.authService.logoutAll(user.userId);
  }

  @Get('google')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({
    summary: 'Começa o login com Google (redireciona para o Google)',
  })
  @ApiResponse({ status: 302, description: 'Tela de login do Google' })
  @ApiResponse({ status: 404, description: 'Login com Google desligado' })
  googleStart(@Res() res: Response): void {
    const { url, cookie, secure } = this.google.start();
    res.cookie(GOOGLE_COOKIE, cookie, {
      httpOnly: true,
      // Lax: o cookie volta na navegação do Google para cá, e só nela.
      sameSite: 'lax',
      secure,
      path: GOOGLE_COOKIE_PATH,
      maxAge: GOOGLE_FLOW_TTL_MS,
    });
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(HttpStatus.FOUND, url);
  }

  @Get('google/callback')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({
    summary:
      'Volta do Google: redireciona ao app com um código de uso único (#code=) ou o motivo da recusa (#erro=)',
  })
  @ApiQuery({ name: 'code', required: false, description: 'Código do Google' })
  @ApiQuery({
    name: 'state',
    required: false,
    description: 'Deve bater com o cookie da ida',
  })
  @ApiQuery({
    name: 'error',
    required: false,
    description: 'Ex.: access_denied',
  })
  @ApiResponse({ status: 302, description: 'Tela /app/entrar/google' })
  async googleCallback(
    @Query() query: Record<string, unknown>,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const destino = await this.google.callback(
      query,
      readCookie(req.headers.cookie, GOOGLE_COOKIE),
    );
    res.clearCookie(GOOGLE_COOKIE, {
      httpOnly: true,
      sameSite: 'lax',
      path: GOOGLE_COOKIE_PATH,
    });
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(HttpStatus.FOUND, destino);
  }

  @Post('google/exchange')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Troca o código de uso único da volta do Google por um token de acesso',
  })
  googleExchange(@Body() dto: GoogleExchangeDto): Promise<GoogleAuthResult> {
    return this.google.exchange(dto.code);
  }
}
