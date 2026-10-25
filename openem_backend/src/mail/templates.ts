/** Uma mensagem pronta para o `MailService`, em texto e em HTML. */
export interface MailContent {
  subject: string;
  text: string;
  html: string;
}

function escapeHtml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * E-mail de "esqueci minha senha". Curto, sem imagem nem rastreio, e com a
 * saída para quem não pediu: ignorar mantém a senha.
 */
export function passwordResetEmail(link: string, minutes: number): MailContent {
  const subject = 'Crie uma senha nova no OpENEM';
  const text = [
    'Olá!',
    '',
    'Recebemos um pedido para criar uma senha nova na conta do OpENEM ligada a este e-mail.',
    '',
    `Abra o link abaixo para criar a senha. Ele vale por ${minutes} minutos e funciona uma vez só:`,
    link,
    '',
    'Se não foi você, ignore este e-mail: a sua senha continua a mesma.',
    '',
    'OpENEM',
  ].join('\n');
  const href = escapeHtml(link);
  const html = `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:24px;background:#f6f6f6;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px">
    <p style="margin:0 0 16px;font-size:20px;font-weight:bold">OpENEM</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5">Recebemos um pedido para criar uma senha nova na conta do OpENEM ligada a este e-mail.</p>
    <p style="margin:0 0 24px"><a href="${href}" style="display:inline-block;background:#c8102e;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:8px">Criar senha nova</a></p>
    <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#555555">O link vale por ${minutes} minutos e funciona uma vez só. Se o botão não abrir, copie este endereço no navegador:<br><span style="word-break:break-all">${href}</span></p>
    <p style="margin:0;font-size:13px;line-height:1.5;color:#555555">Se não foi você, ignore este e-mail: a sua senha continua a mesma.</p>
  </div>
</body>
</html>`;
  return { subject, text, html };
}
