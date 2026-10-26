import { MailService, type MailTransport } from './mail.service';
import { passwordResetEmail } from './templates';

describe('passwordResetEmail', () => {
  const link = 'https://o.ex/app/redefinir-senha#token=abc';

  it('leva o link, o prazo e a saída para quem não pediu', () => {
    const m = passwordResetEmail(link, 30);
    expect(m.subject).toMatch(/senha nova/);
    expect(m.text).toContain(link);
    expect(m.text).toContain('30 minutos');
    expect(m.text).toMatch(/ignore este e-mail/);
    expect(m.html).toContain(`href="${link}"`);
    expect(m.html).toContain('30 minutos');
  });

  it('escapa o link no HTML', () => {
    const m = passwordResetEmail('https://o.ex/"><script>&\'', 30);
    expect(m.html).not.toContain('<script>');
    expect(m.html).toContain('&quot;&gt;&lt;script&gt;&amp;&#39;');
  });
});

describe('MailService', () => {
  it('desligado sem transporte ou sem remetente', async () => {
    expect(new MailService(null, null).enabled).toBe(false);
    const transporte: MailTransport = { sendMail: jest.fn() };
    expect(new MailService(transporte, null).enabled).toBe(false);
    await expect(
      new MailService(null, 'a@b.c').send('x@y.z', passwordResetEmail('l', 30)),
    ).rejects.toThrow(/SMTP não configurado/);
  });

  it('manda com o remetente configurado e fecha o transporte no fim', async () => {
    const transporte = {
      sendMail: jest.fn().mockResolvedValue({}),
      close: jest.fn(),
    };
    const mail = new MailService(transporte, 'OpENEM <nao-responda@o.ex>');
    expect(mail.enabled).toBe(true);
    const conteudo = passwordResetEmail('https://o.ex/l', 30);
    await mail.send('aluna@o.ex', conteudo);
    expect(transporte.sendMail).toHaveBeenCalledWith({
      ...conteudo,
      from: 'OpENEM <nao-responda@o.ex>',
      to: 'aluna@o.ex',
    });
    mail.onModuleDestroy();
    expect(transporte.close).toHaveBeenCalled();
  });
});
