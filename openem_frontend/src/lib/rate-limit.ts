// Resposta 429 da API (issue #87): quanto esperar e o que dizer ao aluno.

/**
 * Segundos do cabeçalho Retry-After, em segundos ("30") ou data HTTP. null
 * quando falta ou não dá para ler. Nunca menos de 1: "tente já" confunde.
 */
export function parseRetryAfter(
  header: string | null | undefined,
  now: number = Date.now(),
): number | null {
  const valor = header?.trim();
  if (!valor) return null;
  if (/^\d+$/.test(valor)) return Math.max(1, Number(valor));
  // Data HTTP tem dia da semana e mês por extenso; sem letras, o Date.parse
  // aceitaria qualquer coisa ("-5", "1.5").
  if (!/[a-z]/i.test(valor)) return null;
  const quando = Date.parse(valor);
  if (Number.isNaN(quando)) return null;
  return Math.max(1, Math.ceil((quando - now) / 1000));
}

/** O mesmo texto do backend (`rateLimitMessage`), para as duas falarem igual. */
export function rateLimitMessage(seconds: number | null): string {
  if (seconds === null) return 'Muitas tentativas. Tente de novo em instantes.';
  return seconds >= 120
    ? `Muitas tentativas. Tente de novo em ${Math.ceil(seconds / 60)} min.`
    : `Muitas tentativas. Tente de novo em ${seconds} s.`;
}

/** Contagem regressiva em m:ss (ou h:mm:ss), como num relógio. */
export function countdown(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
