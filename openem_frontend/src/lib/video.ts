// Helpers puros da videoteca (issue #37): parsing/formatação de timestamp e
// montagem da URL de embed. Vivem fora da página para poderem ser testados e
// mutados isoladamente (e para não quebrar o fast refresh do Vite).

/** Limite do backend para `timestampSec` (AddVideoNoteDto: Max(86400)). */
export const MAX_TIMESTAMP_SEC = 86_400;

/** Formata segundos como m:ss, ou h:mm:ss quando passa de uma hora. */
export function fmtTimestamp(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${s.toString().padStart(2, '0')}`;
}

/**
 * Converte o instante digitado em segundos. Aceita "90" (segundos),
 * "1:30" (mm:ss) e "1:30:00" (h:mm:ss) — antes as horas eram descartadas e
 * uma nota em 1:30:00 virava 1min30. Retorna null quando o texto é inválido.
 */
export function parseTimestamp(raw: string): number | null {
  const input = raw.trim();
  if (input === '') return 0;
  const parts = input.split(':');
  if (parts.length > 3) return null;
  const nums: number[] = [];
  for (const part of parts) {
    const n = Number(part.replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) return null;
    nums.push(Math.floor(n));
  }
  // Da direita para a esquerda: segundos, minutos, horas.
  const total = nums.reverse().reduce((sum, n, i) => sum + n * 60 ** i, 0);
  return total > MAX_TIMESTAMP_SEC ? null : total;
}

/**
 * URL do embed do YouTube. O `start` precisa entrar depois de um `?`: sem ele
 * o `&autoplay=...` virava parte do ID do vídeo e o embed era recusado.
 */
export function embedUrl(youtubeId: string, seekTo: number | null): string {
  const params = new URLSearchParams({ autoplay: seekTo === null ? '0' : '1' });
  if (seekTo !== null) params.set('start', String(seekTo));
  return `https://www.youtube-nocookie.com/embed/${youtubeId}?${params.toString()}`;
}
