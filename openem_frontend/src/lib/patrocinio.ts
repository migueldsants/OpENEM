/**
 * Quando o convite para patrocinar o OpENEM aparece. Ele abre ao entrar no
 * app, no máximo uma vez por login, e quem dispensa não o vê de novo por um
 * tempo. A regra é pura; o estado fica no `localStorage` (`openem.patrocinio`).
 */

export const CHAVE_PATROCINIO = 'openem.patrocinio';

const DIA_MS = 24 * 60 * 60 * 1000;

/** Conta nova não vê o convite nos primeiros dias: primeiro, conhecer o app. */
export const CARENCIA_MS = 3 * DIA_MS;
/** "Agora não": volta a aparecer depois de uma semana. */
export const ADIAR_MS = 7 * DIA_MS;
/** Quem foi ao GitHub Sponsors não é convidado de novo por três meses. */
export const APOIOU_MS = 90 * DIA_MS;

export interface EstadoPatrocinio {
  /** Último login em que o convite apareceu. */
  sessao?: string;
  /** Antes deste instante (ms), o convite não aparece. */
  adiadoAte?: number;
}

/** Como o convite foi fechado. "fechar" (X, Esc, clique fora) não adia. */
export type Resposta = 'fechar' | 'agora-nao' | 'patrocinar';

/**
 * Identifica o login: o `sub` e o `iat` do JWT. Cada entrada emite um token
 * novo; reabrir o app com o mesmo token é a mesma sessão. Só a identificação
 * vai para o `localStorage`, nunca o token.
 */
export function sessaoDoToken(token: string | null): string | null {
  if (!token) return null;
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { sub, iat } = JSON.parse(atob(payload)) as { sub?: unknown; iat?: unknown };
    if (typeof sub !== 'string' || typeof iat !== 'number') return null;
    return `${sub}:${iat}`;
  } catch {
    return null;
  }
}

export function deveMostrar({
  estado,
  sessao,
  agora,
  contaCriadaEm,
}: {
  estado: EstadoPatrocinio;
  sessao: string | null;
  agora: number;
  /** `Me.createdAt` em ms; NaN ou ausente não segura o convite. */
  contaCriadaEm?: number;
}): boolean {
  if (!sessao || estado.sessao === sessao) return false;
  if (estado.adiadoAte !== undefined && agora < estado.adiadoAte) return false;
  if (contaCriadaEm !== undefined && agora - contaCriadaEm < CARENCIA_MS) return false;
  return true;
}

/** O convite apareceu neste login: não abre de novo até o próximo. */
export function marcarMostrado(estado: EstadoPatrocinio, sessao: string): EstadoPatrocinio {
  return { ...estado, sessao };
}

export function responder(
  estado: EstadoPatrocinio,
  resposta: Resposta,
  agora: number,
): EstadoPatrocinio {
  if (resposta === 'agora-nao') return { ...estado, adiadoAte: agora + ADIAR_MS };
  if (resposta === 'patrocinar') return { ...estado, adiadoAte: agora + APOIOU_MS };
  return estado;
}

/** Lê o estado salvo; valor corrompido ou `localStorage` bloqueado viram `{}`. */
export function lerEstado(storage: Pick<Storage, 'getItem'> | undefined): EstadoPatrocinio {
  try {
    const bruto = storage?.getItem(CHAVE_PATROCINIO);
    if (!bruto) return {};
    const dado = JSON.parse(bruto) as Record<string, unknown>;
    if (!dado || typeof dado !== 'object') return {};
    const estado: EstadoPatrocinio = {};
    if (typeof dado.sessao === 'string') estado.sessao = dado.sessao;
    if (typeof dado.adiadoAte === 'number' && Number.isFinite(dado.adiadoAte)) {
      estado.adiadoAte = dado.adiadoAte;
    }
    return estado;
  } catch {
    return {};
  }
}

export function gravarEstado(
  storage: Pick<Storage, 'setItem'> | undefined,
  estado: EstadoPatrocinio,
): void {
  try {
    storage?.setItem(CHAVE_PATROCINIO, JSON.stringify(estado));
  } catch {
    // localStorage cheio ou bloqueado: o convite segue preso à aba aberta.
  }
}
