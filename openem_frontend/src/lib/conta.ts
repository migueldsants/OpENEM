// Telas de conta fora do login: o que vem no fragmento das URLs de volta.

/**
 * Valor de um parâmetro do fragmento (`#token=...`). O link do e-mail e a
 * volta do Google mandam o segredo no fragmento porque o navegador não o
 * envia a servidor nenhum (nem em log, nem no Referer).
 */
export function fragmentParam(hash: string, nome: string): string | null {
  return new URLSearchParams(hash.replace(/^#/, '')).get(nome);
}

/** O que a API manda em `#erro=` na volta do Google, em frase. */
export const ERROS_GOOGLE: Record<string, string> = {
  cancelado: 'Você cancelou a entrada pelo Google.',
  sessao:
    'A entrada pelo Google demorou demais ou foi aberta em outra aba. Tente de novo.',
  email:
    'O Google não confirmou o e-mail desta conta. Use outra conta Google ou entre com e-mail e senha.',
  conta:
    'Este e-mail já está ligado a outra conta Google, ou há mais de uma conta com ele aqui. Entre com e-mail e senha.',
  falha: 'Não foi possível entrar pelo Google. Tente de novo em instantes.',
};

/** Frase de um código de erro da volta do Google (desconhecido = falha). */
export function erroGoogle(codigo: string | null): string {
  return (codigo && ERROS_GOOGLE[codigo]) || ERROS_GOOGLE.falha;
}
