// O que a grade pode colorir além da categoria: estado físico numa
// temperatura escolhida, mapa de calor de uma propriedade e as tendências
// periódicas que a tela explica. Puro e testado.

import { evParaKjMol, type Elemento, type Estado } from './elementos';

/**
 * Estado físico a `kelvin` e 1 atm, pelos pontos de fusão e de ebulição.
 * Sem os pontos (ou com eles estimados), devolve null: a tela diz
 * "desconhecido", nunca adivinha. Carbono e arsênio sublimam; o hélio não
 * solidifica a 1 atm. (A mesma regra calcula o estado a 25 °C no roteiro.)
 */
export function estadoNaTemperatura(
  e: Pick<Elemento, 'fusao' | 'ebulicao' | 'semFusao'>,
  kelvin: number,
): Estado | null {
  if (e.fusao?.estimado || e.ebulicao?.estimado) return null;
  if (e.semFusao === 'sublima') return e.ebulicao ? (kelvin < e.ebulicao.k ? 'solido' : 'gasoso') : null;
  if (e.semFusao === 'nao-solidifica') return e.ebulicao ? (kelvin < e.ebulicao.k ? 'liquido' : 'gasoso') : null;
  if (!e.fusao) return null;
  if (kelvin < e.fusao.k) return 'solido';
  if (!e.ebulicao) return null;
  return kelvin < e.ebulicao.k ? 'liquido' : 'gasoso';
}

export const TEMPERATURA_AMBIENTE_K = 298.15;

export type PropriedadeKey =
  | 'eletronegatividade'
  | 'raio'
  | 'energiaIonizacao'
  | 'afinidade'
  | 'densidade'
  | 'fusao'
  | 'ebulicao';

export interface Propriedade {
  key: PropriedadeKey;
  rotulo: string;
  unidade: string;
  /** Densidade varia de 10⁻⁴ a 22: escala logarítmica, senão quase tudo fica igual. */
  log?: boolean;
  /** Valor numérico do elemento, ou null se desconhecido. */
  valor: (e: Elemento) => number | null;
  estimado: (e: Elemento) => boolean;
}

export const PROPRIEDADES: Propriedade[] = [
  {
    key: 'eletronegatividade',
    rotulo: 'Eletronegatividade',
    unidade: 'Pauling',
    valor: (e) => e.eletronegatividade?.valor ?? null,
    estimado: (e) => Boolean(e.eletronegatividade?.estimado),
  },
  {
    key: 'raio',
    rotulo: 'Raio atômico',
    unidade: 'pm',
    valor: (e) => e.raio?.valor ?? null,
    estimado: (e) => Boolean(e.raio?.estimado),
  },
  {
    key: 'energiaIonizacao',
    rotulo: 'Energia de ionização',
    unidade: 'kJ/mol',
    valor: (e) => (e.energiaIonizacao ? Math.round(evParaKjMol(Number(e.energiaIonizacao.ev))) : null),
    // O do hidrogênio é "teórico" no NIST, mas é um cálculo mais exato que a medida.
    estimado: (e) => Boolean(e.energiaIonizacao?.estimado) && e.z !== 1,
  },
  {
    key: 'afinidade',
    rotulo: 'Afinidade eletrônica',
    unidade: 'kJ/mol',
    // Sem ânion estável, a afinidade é negativa ou nula: fica no fundo da escala.
    valor: (e) =>
      e.afinidade == null ? null : 'anionInstavel' in e.afinidade ? 0 : Math.round(evParaKjMol(e.afinidade.ev)),
    estimado: (e) => Boolean(e.afinidade && 'ev' in e.afinidade && e.afinidade.estimado),
  },
  {
    key: 'densidade',
    rotulo: 'Densidade',
    unidade: 'g/cm³',
    log: true,
    valor: (e) => e.densidade?.valor ?? null,
    estimado: (e) => Boolean(e.densidade?.estimado),
  },
  {
    key: 'fusao',
    rotulo: 'Ponto de fusão',
    unidade: '°C',
    valor: (e) => (e.fusao ? Math.round(e.fusao.k - 273.15) : null),
    estimado: (e) => Boolean(e.fusao?.estimado),
  },
  {
    key: 'ebulicao',
    rotulo: 'Ponto de ebulição',
    unidade: '°C',
    valor: (e) => (e.ebulicao ? Math.round(e.ebulicao.k - 273.15) : null),
    estimado: (e) => Boolean(e.ebulicao?.estimado),
  },
];

export const PASSOS_ESCALA = 7;

export interface Escala {
  min: number;
  max: number;
  log: boolean;
  /** Índice do degrau (0 … PASSOS_ESCALA − 1), ou null se o valor é desconhecido. */
  passo: (valor: number | null) => number | null;
  /** Valores nas bordas dos degraus, para a legenda. */
  marcas: number[];
}

/**
 * Escala sequencial de `passos` degraus entre o menor e o maior valor
 * conhecido. Em escala log, os valores ≤ 0 não entram (densidade nunca é).
 */
export function escala(valores: (number | null)[], log = false, passos = PASSOS_ESCALA): Escala {
  const conhecidos = valores.filter((v): v is number => v != null && Number.isFinite(v) && (!log || v > 0));
  const min = Math.min(...conhecidos);
  const max = Math.max(...conhecidos);
  const t = (v: number) => (log ? Math.log10(v) : v);
  const a = t(min);
  const b = t(max);
  const passo = (v: number | null) => {
    if (v == null || !Number.isFinite(v) || (log && v <= 0) || conhecidos.length === 0) return null;
    if (b === a) return 0;
    const frac = (t(v) - a) / (b - a);
    return Math.min(passos - 1, Math.max(0, Math.floor(frac * passos)));
  };
  const marcas = Array.from({ length: passos + 1 }, (_, i) => {
    const x = a + ((b - a) * i) / passos;
    return log ? 10 ** x : x;
  });
  return { min, max, log, passo, marcas };
}

/** As três tendências que o ENEM cobra, com o sentido de crescimento. */
export interface Tendencia {
  key: 'raio' | 'energiaIonizacao' | 'eletronegatividade';
  rotulo: string;
  /** Para onde cresce ao longo do período e ao longo do grupo. */
  periodo: 'esquerda' | 'direita';
  grupo: 'cima' | 'baixo';
  explicacao: string;
}

export const TENDENCIAS: Tendencia[] = [
  {
    key: 'raio',
    rotulo: 'Raio atômico',
    periodo: 'esquerda',
    grupo: 'baixo',
    explicacao:
      'Descendo no grupo, cada período acrescenta uma camada de elétrons e o átomo cresce. Ao longo do período, a carga do núcleo aumenta sem camada nova, atrai mais os elétrons e o átomo encolhe: o raio cresce para a esquerda e para baixo.',
  },
  {
    key: 'energiaIonizacao',
    rotulo: 'Energia de ionização',
    periodo: 'direita',
    grupo: 'cima',
    explicacao:
      'É a energia para arrancar o elétron mais externo. Quanto menor o átomo, mais perto do núcleo está esse elétron e mais difícil é tirá-lo: cresce para a direita e para cima, o oposto do raio. Os gases nobres têm as maiores; os metais alcalinos, as menores.',
  },
  {
    key: 'eletronegatividade',
    rotulo: 'Eletronegatividade',
    periodo: 'direita',
    grupo: 'cima',
    explicacao:
      'É a tendência de atrair os elétrons de uma ligação. Segue a energia de ionização: cresce para a direita e para cima, e o flúor é o mais eletronegativo. Os gases nobres ficam de fora, porque quase não formam ligações.',
  },
];

// ---------------------------------------------------------------------------
// Cor de cada casa

export type ModoCor =
  | { tipo: 'categoria' }
  | { tipo: 'bloco' }
  | { tipo: 'estado'; kelvin: number }
  | { tipo: 'calor'; propriedade: PropriedadeKey };

/** Bloco e estado reaproveitam os tons das categorias (`--tp-<tom>`). */
export const TOM_BLOCO: Record<Elemento['bloco'], string> = {
  s: 'alcalino',
  p: 'nao-metal',
  d: 'transicao',
  f: 'lantanideo',
};

export const TOM_ESTADO: Record<Estado, string> = {
  solido: 'pos-transicao',
  liquido: 'transicao',
  gasoso: 'alcalino-terroso',
};

export interface TomDaCasa {
  /** Sufixo do token `--tp-…` do tom, ou null quando o valor é desconhecido. */
  tom: string | null;
  /** Degrau do mapa de calor (0…6); null fora do mapa de calor. */
  passo: number | null;
  estimado: boolean;
}

/**
 * Tom da casa no modo de cor escolhido. Desconhecido vira `tom: null` (a
 * tela desenha a hachura), nunca uma cor da escala.
 */
export function tomDaCasa(e: Elemento, modo: ModoCor, esc?: Escala): TomDaCasa {
  switch (modo.tipo) {
    case 'categoria':
      return { tom: e.categoria, passo: null, estimado: Boolean(e.categoriaPrevista) };
    case 'bloco':
      return { tom: TOM_BLOCO[e.bloco], passo: null, estimado: false };
    case 'estado': {
      const estado = estadoNaTemperatura(e, modo.kelvin);
      return { tom: estado ? TOM_ESTADO[estado] : null, passo: null, estimado: false };
    }
    case 'calor': {
      const p = PROPRIEDADES.find((x) => x.key === modo.propriedade)!;
      const passo = esc ? esc.passo(p.valor(e)) : null;
      return { tom: passo == null ? null : 'calor', passo, estimado: passo != null && p.estimado(e) };
    }
  }
}
