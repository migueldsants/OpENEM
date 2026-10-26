import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import type { MailContent } from './templates';

/** O pedaço do transporte do nodemailer que o serviço usa. */
export interface MailTransport {
  sendMail(
    message: MailContent & { from: string; to: string },
  ): Promise<unknown>;
  close?(): void;
}

/** Transporte SMTP, ou null quando `SMTP_URL`/`MAIL_FROM` não estão definidas. */
export const MAIL_TRANSPORT = Symbol('MAIL_TRANSPORT');
/** Remetente (`MAIL_FROM`). */
export const MAIL_FROM = Symbol('MAIL_FROM');

/**
 * Envio de e-mail (hoje, só o link de redefinição de senha). O SMTP é de quem
 * hospeda e opcional: sem ele, `enabled` é false e quem chama não oferece o
 * recurso.
 */
@Injectable()
export class MailService implements OnModuleDestroy {
  constructor(
    @Inject(MAIL_TRANSPORT) private readonly transport: MailTransport | null,
    @Inject(MAIL_FROM) private readonly from: string | null,
  ) {}

  get enabled(): boolean {
    return this.transport !== null && !!this.from;
  }

  async send(to: string, content: MailContent): Promise<void> {
    if (!this.transport || !this.from) {
      throw new Error('SMTP não configurado (SMTP_URL e MAIL_FROM)');
    }
    await this.transport.sendMail({ ...content, from: this.from, to });
  }

  onModuleDestroy(): void {
    this.transport?.close?.();
  }
}
