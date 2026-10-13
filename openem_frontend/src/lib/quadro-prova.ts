// Núcleo puro do quadro da sala: as marcas de tempo que o fiscal escreve no
// quadro durante a prova e vai apagando. Serve para o simulado no papel — o
// aluno imprime o caderno e deixa esta tela à vista, como na sala do ENEM.
// Fica separado do componente para ser testado sem React.

export interface QuadroSessao {
  /** Instante de início, em ms desde a época. */
  startedAt: number;
  durationMin: number;
  /** De quanto em quanto tempo o quadro é atualizado. */
  intervalMin: number;
}

/** Durações oficiais: 1º dia tem redação (5h30), 2º dia não (5h). */
export const DURACOES: { key: string; label: string; min: number }[] = [
  { key: 'dia1', label: 'Dia 1', min: 330 },
  { key: 'dia2', label: 'Dia 2', min: 300 },
];

export const INTERVALOS = [15, 30, 60];

export const MIN_DURACAO = 10;
export const MAX_DURACAO = 600;

/** No ENEM o candidato só pode deixar a sala 2 horas depois do início. */
const SAIDA_APOS_MIN = 120;
/** E só leva o caderno de questões nos últimos 30 minutos. */
const CADERNO_ULTIMOS_MIN = 30;
/** Abaixo disso as regras de saída não fazem sentido (simulado curto). */
const MIN_PARA_REGRAS = 180;
/** Quadro encerrado há mais tempo que isso é lixo de outro dia. */
const VALIDADE_APOS_FIM_MS = 6 * 60 * 60 * 1000;

/** Normaliza o que vem do formulário: inteiros dentro dos limites. */
export function clampSessao(s: {
  startedAt: number;
  durationMin: unknown;
  intervalMin: unknown;
}): QuadroSessao {
  const d = Number(s.durationMin);
  const durationMin = Number.isFinite(d)
    ? Math.min(MAX_DURACAO, Math.max(MIN_DURACAO, Math.round(d)))
    : DURACOES[0].min;
  const intervalMin = INTERVALOS.includes(Number(s.intervalMin))
    ? Number(s.intervalMin)
    : 30;
  return { startedAt: s.startedAt, durationMin, intervalMin };
}

/**
 * Lê a sessão salva. Devolve `null` para JSON quebrado, campos inválidos ou
 * um quadro que terminou há horas (o aluno esqueceu de encerrar).
 */
export function lerSessao(
  raw: string | null,
  agora: number,
): QuadroSessao | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<QuadroSessao> | null;
    if (!p || typeof p.startedAt !== 'number' || !Number.isFinite(p.startedAt))
      return null;
    if (typeof p.durationMin !== 'number' || typeof p.intervalMin !== 'number')
      return null;
    const sessao = clampSessao({
      startedAt: p.startedAt,
      durationMin: p.durationMin,
      intervalMin: p.intervalMin,
    });
    const fim = sessao.startedAt + sessao.durationMin * 60_000;
    if (agora - fim > VALIDADE_APOS_FIM_MS) return null;
    return sessao;
  } catch {
    return null;
  }
}

/**
 * Marcas de tempo restante, da maior para a menor: a duração inteira e depois
 * os múltiplos do intervalo. 330 de 30 em 30 → 330, 300, …, 30.
 */
export function marcas(durationMin: number, intervalMin: number): number[] {
  const out = [durationMin];
  const primeira = (Math.ceil(durationMin / intervalMin) - 1) * intervalMin;
  for (let m = primeira; m > 0; m -= intervalMin) out.push(m);
  return out;
}

export interface EstadoQuadro {
  /** Segundos que faltam de verdade (nunca negativo). */
  restanteSec: number;
  encerrado: boolean;
  /**
   * Marca que está valendo no quadro: a última que o fiscal atualizou. Entre
   * duas atualizações ela fica parada, como na sala. `null` quando acabou.
   */
  marcaAtual: number | null;
  /** Instante em que a marca atual foi escrita. */
  atualizadoEm: number;
  /** Quantas marcas já foram apagadas, contando do começo da lista. */
  apagadas: number;
}

export function estadoDoQuadro(s: QuadroSessao, agora: number): EstadoQuadro {
  const totalSec = s.durationMin * 60;
  const decorrido = Math.max(0, Math.floor((agora - s.startedAt) / 1000));
  const restanteSec = Math.max(0, totalSec - decorrido);
  const lista = marcas(s.durationMin, s.intervalMin);
  if (restanteSec === 0) {
    return {
      restanteSec,
      encerrado: true,
      marcaAtual: null,
      atualizadoEm: s.startedAt + totalSec * 1000,
      apagadas: lista.length,
    };
  }
  // Vale a menor marca que ainda cobre o tempo restante.
  const apagadas = lista.filter((m) => m * 60 >= restanteSec).length - 1;
  const marcaAtual = lista[apagadas];
  return {
    restanteSec,
    encerrado: false,
    marcaAtual,
    atualizadoEm: s.startedAt + (s.durationMin - marcaAtual) * 60_000,
    apagadas,
  };
}

export interface AvisoQuadro {
  key: 'saida' | 'caderno';
  texto: string;
  /** Instante a partir do qual vale. */
  em: number;
  liberado: boolean;
}

/** Regras de saída do ENEM, com o horário já calculado para esta prova. */
export function avisos(s: QuadroSessao, agora: number): AvisoQuadro[] {
  if (s.durationMin < MIN_PARA_REGRAS) return [];
  const saida = s.startedAt + SAIDA_APOS_MIN * 60_000;
  const caderno =
    s.startedAt + (s.durationMin - CADERNO_ULTIMOS_MIN) * 60_000;
  return [
    {
      key: 'saida',
      texto: 'Saída da sala',
      em: saida,
      liberado: agora >= saida,
    },
    {
      key: 'caderno',
      texto: 'Levar o caderno de questões',
      em: caderno,
      liberado: agora >= caderno,
    },
  ];
}

/** 330 → "5h30", 300 → "5h", 45 → "45 min". */
export function fmtMarca(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

/** Horário de parede no formato do quadro: "13h30". */
export function fmtHora(ms: number): string {
  const d = new Date(ms);
  return `${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}`;
}
