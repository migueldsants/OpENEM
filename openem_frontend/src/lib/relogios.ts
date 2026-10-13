// Núcleo puro da tela de cronômetros e timers. Nada aqui tem a ver com o
// Pomodoro: são relógios avulsos, sem XP nem registro de sessão.
//
// O tempo é sempre derivado de instantes (`rodandoDesde`), nunca de um
// contador decrementado: o navegador estrangula o setInterval de abas em
// segundo plano, e o relógio precisa sobreviver a recarregar a página.

export type TipoRelogio = 'cronometro' | 'timer';

export interface Relogio {
  id: string;
  tipo: TipoRelogio;
  nome: string;
  /** Tempo corrido até a última pausa. */
  acumuladoMs: number;
  /** Instante em que voltou a correr; `null` = parado. */
  rodandoDesde: number | null;
  /** Só no timer: de quanto ele conta. */
  duracaoMs: number | null;
  /** Só no cronômetro: tempo total em que cada volta foi marcada. */
  voltas: number[];
  /** Só no timer: o aviso de fim já tocou. */
  tocou: boolean;
}

export const MAX_RELOGIOS = 12;
export const MAX_NOME = 40;
export const MAX_VOLTAS = 99;
export const MIN_TIMER_MS = 1000;
export const MAX_TIMER_MS = 24 * 60 * 60 * 1000;

/** Atalhos de duração do formulário de timer, em minutos. */
export const PRESETS_TIMER_MIN = [1, 3, 5, 10, 15, 30, 60];

function prender(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Minutos e segundos do formulário → duração válida de timer. */
export function duracaoDe(min: unknown, seg: unknown): number {
  const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const ms = Math.round(n(min) * 60 + n(seg)) * 1000;
  return prender(ms, MIN_TIMER_MS, MAX_TIMER_MS);
}

/** Nome digitado, aparado e limitado; vazio cai no `padrao`. */
export function nomeLimpo(nome: string, padrao: string): string {
  const limpo = nome.trim().slice(0, MAX_NOME);
  return limpo === '' ? padrao : limpo;
}

export function novoCronometro(id: string, nome: string): Relogio {
  return {
    id,
    tipo: 'cronometro',
    nome,
    acumuladoMs: 0,
    rodandoDesde: null,
    duracaoMs: null,
    voltas: [],
    tocou: false,
  };
}

export function novoTimer(id: string, nome: string, duracaoMs: number): Relogio {
  return {
    ...novoCronometro(id, nome),
    tipo: 'timer',
    duracaoMs: prender(Math.round(duracaoMs), MIN_TIMER_MS, MAX_TIMER_MS),
  };
}

/** Tempo corrido. No timer, para na duração. */
export function decorridoMs(r: Relogio, agora: number): number {
  const correndo =
    r.rodandoDesde != null ? Math.max(0, agora - r.rodandoDesde) : 0;
  const total = r.acumuladoMs + correndo;
  return r.duracaoMs != null ? Math.min(r.duracaoMs, total) : total;
}

/** Quanto falta no timer (0 no cronômetro). */
export function restanteMs(r: Relogio, agora: number): number {
  if (r.duracaoMs == null) return 0;
  return r.duracaoMs - decorridoMs(r, agora);
}

export function terminou(r: Relogio, agora: number): boolean {
  return r.duracaoMs != null && restanteMs(r, agora) <= 0;
}

export function rodando(r: Relogio, agora: number): boolean {
  return r.rodandoDesde != null && !terminou(r, agora);
}

export function iniciar(r: Relogio, agora: number): Relogio {
  if (r.rodandoDesde != null || terminou(r, agora)) return r;
  return { ...r, rodandoDesde: agora };
}

export function pausar(r: Relogio, agora: number): Relogio {
  if (r.rodandoDesde == null) return r;
  return { ...r, acumuladoMs: decorridoMs(r, agora), rodandoDesde: null };
}

export function zerar(r: Relogio): Relogio {
  return { ...r, acumuladoMs: 0, rodandoDesde: null, voltas: [], tocou: false };
}

/** Marca uma volta — só em cronômetro correndo. */
export function marcarVolta(r: Relogio, agora: number): Relogio {
  if (r.tipo !== 'cronometro' || r.rodandoDesde == null) return r;
  if (r.voltas.length >= MAX_VOLTAS) return r;
  return { ...r, voltas: [...r.voltas, decorridoMs(r, agora)] };
}

export interface Parcial {
  numero: number;
  /** Tempo total quando a volta foi marcada. */
  totalMs: number;
  /** Tempo só desta volta. */
  parcialMs: number;
}

export function parciais(voltas: number[]): Parcial[] {
  return voltas.map((totalMs, i) => ({
    numero: i + 1,
    totalMs,
    parcialMs: totalMs - (i > 0 ? voltas[i - 1] : 0),
  }));
}

/** Instante em que o timer correndo vai acabar; `null` se não está correndo. */
export function fimEm(r: Relogio): number | null {
  if (r.duracaoMs == null || r.rodandoDesde == null) return null;
  return r.rodandoDesde + (r.duracaoMs - r.acumuladoMs);
}

/** O próximo fim de timer que ainda não chegou, para agendar o aviso. */
export function proximoFim(lista: Relogio[], agora: number): number | null {
  let menor: number | null = null;
  for (const r of lista) {
    const fim = fimEm(r);
    if (fim == null || fim <= agora) continue;
    if (menor == null || fim < menor) menor = fim;
  }
  return menor;
}

/** Timers que acabaram e ainda não avisaram. */
export function aTocar(lista: Relogio[], agora: number): Relogio[] {
  return lista.filter((r) => !r.tocou && terminou(r, agora));
}

function relogioValido(v: unknown): Relogio | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  if (typeof r.id !== 'string' || r.id === '') return null;
  if (r.tipo !== 'cronometro' && r.tipo !== 'timer') return null;
  const num = (x: unknown) => typeof x === 'number' && Number.isFinite(x);
  if (!num(r.acumuladoMs) || (r.acumuladoMs as number) < 0) return null;
  if (r.rodandoDesde !== null && !num(r.rodandoDesde)) return null;
  if (r.tipo === 'timer' && !num(r.duracaoMs)) return null;
  const voltas = Array.isArray(r.voltas) ? r.voltas.filter(num) : [];
  const base = {
    acumuladoMs: r.acumuladoMs as number,
    rodandoDesde: r.rodandoDesde as number | null,
    voltas: (voltas as number[]).slice(0, MAX_VOLTAS),
    tocou: r.tocou === true,
  };
  const nome = (padrao: string) =>
    nomeLimpo(typeof r.nome === 'string' ? r.nome : '', padrao);
  if (r.tipo === 'timer') {
    return {
      ...novoTimer(r.id, nome('Timer'), r.duracaoMs as number),
      ...base,
      voltas: [],
    };
  }
  return { ...novoCronometro(r.id, nome('Cronômetro')), ...base, tocou: false };
}

/** Lê a lista salva, descartando o que estiver quebrado. */
export function lerRelogios(raw: string | null): Relogio[] {
  if (!raw) return [];
  try {
    const lista: unknown = JSON.parse(raw);
    if (!Array.isArray(lista)) return [];
    return lista
      .map(relogioValido)
      .filter((r): r is Relogio => r !== null)
      .slice(0, MAX_RELOGIOS);
  } catch {
    return [];
  }
}

function hms(totalSeg: number): string {
  const h = Math.floor(totalSeg / 3600);
  const m = Math.floor((totalSeg % 3600) / 60);
  const s = String(totalSeg % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** Cronômetro: `65432` → `"1:05.4"` (décimos, sempre para baixo). */
export function fmtCronometro(ms: number): string {
  const v = Math.max(0, Math.floor(ms));
  return `${hms(Math.floor(v / 1000))}.${Math.floor((v % 1000) / 100)}`;
}

/**
 * Timer: `4200` → `"0:05"`. Arredonda para cima, para o `0:00` só aparecer
 * quando o tempo acabou de fato.
 */
export function fmtTimer(ms: number): string {
  return hms(Math.ceil(Math.max(0, ms) / 1000));
}

/** Duração por extenso, para o nome padrão: `"5 min"`, `"1h30"`, `"45 s"`. */
export function fmtDuracao(ms: number): string {
  const seg = Math.round(ms / 1000);
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const s = seg % 60;
  if (h > 0) return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
  if (m > 0) return s > 0 ? `${m} min ${s} s` : `${m} min`;
  return `${s} s`;
}
