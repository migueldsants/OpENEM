import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import { authFeatures, type AuthEnv } from '../common/auth-config';
import {
  MAIL_FROM,
  MAIL_TRANSPORT,
  MailService,
  type MailTransport,
} from './mail.service';

function mailConfig(config: ConfigService) {
  return authFeatures({
    NODE_ENV: config.get<string>('NODE_ENV'),
    SITE_URL: config.get<string>('SITE_URL'),
    SMTP_URL: config.get<string>('SMTP_URL'),
    MAIL_FROM: config.get<string>('MAIL_FROM'),
  } satisfies AuthEnv).mail;
}

@Module({
  providers: [
    {
      provide: MAIL_TRANSPORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): MailTransport | null => {
        const mail = mailConfig(config);
        // `smtp://` usa STARTTLS quando o servidor oferece; `smtps://`, TLS direto.
        return mail ? (createTransport(mail.url) as MailTransport) : null;
      },
    },
    {
      provide: MAIL_FROM,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => mailConfig(config)?.from ?? null,
    },
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
