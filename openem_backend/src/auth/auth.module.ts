import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { authFeatures, type AuthFeatures } from '../common/auth-config';
import { resolveJwtSecret } from '../common/jwt-secret';
import { MailModule } from '../mail/mail.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AUTH_FEATURES, GOOGLE_FETCH } from './auth.tokens';
import { GoogleAuthService } from './google-auth.service';
import { GoogleOidcClient } from './google-oidc.client';
import { JwtStrategy } from './jwt.strategy';
import { PasswordResetService } from './password-reset.service';
import { SessionsService } from './sessions.service';

/** `fetch` do Node; no provider para os testes trocarem pelo Google falso. */
const googleFetch: typeof fetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => fetch(input, init);

@Module({
  imports: [
    PassportModule,
    MailModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: resolveJwtSecret(config),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '7d'),
        } as JwtModuleOptions['signOptions'],
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    {
      provide: AUTH_FEATURES,
      inject: [ConfigService],
      useFactory: (config: ConfigService): AuthFeatures => {
        const features = authFeatures({
          NODE_ENV: config.get<string>('NODE_ENV'),
          SITE_URL: config.get<string>('SITE_URL'),
          SMTP_URL: config.get<string>('SMTP_URL'),
          MAIL_FROM: config.get<string>('MAIL_FROM'),
          GOOGLE_CLIENT_ID: config.get<string>('GOOGLE_CLIENT_ID'),
          GOOGLE_CLIENT_SECRET: config.get<string>('GOOGLE_CLIENT_SECRET'),
        });
        const logger = new Logger('Auth');
        for (const aviso of features.warnings) logger.warn(aviso);
        return features;
      },
    },
    {
      provide: GOOGLE_FETCH,
      useValue: googleFetch,
    },
    AuthService,
    SessionsService,
    PasswordResetService,
    GoogleOidcClient,
    GoogleAuthService,
    JwtStrategy,
  ],
  exports: [AuthService, SessionsService],
})
export class AuthModule {}
