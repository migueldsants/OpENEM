// Núcleo puro da tela Tabela periódica: tipos do catálogo
// (`src/data/elementos.json`, gerado por `tools/tabela-periodica`), nomes das
// categorias, busca sem acento, filtros, navegação pela grade e formatação
// dos números no padrão brasileiro. Fica separado da página para ser testado
// sem React.

export type CategoriaKey =
  | 'alcalino'
  | 'alcalino-terroso'
  | 'transicao'
  | 'pos-transicao'
  | 'semimetal'
  | 'nao-metal'
  | 'halogenio'
  | 'gas-nobre'
  | 'lantanideo'
  | 'actinideo';

export type Bloco = 's' | 'p' | 'd' | 'f';
export type Estado = 'solido' | 'liquido' | 'gasoso';

/** Valor com incerteza, como texto: os algarismos são os da fonte. */
export interface ValorIncerteza {
  valor: string;
  incerteza: string;
}

export interface MeiaVida {
  valor: string;
  incerteza: string | null;
  unidade: string;
  aproximado?: boolean;
}

export interface Elemento {
  z: number;
  simbolo: string;
  nome: string;
  nomeEn: string;
  variantes?: string[];
  periodo: number;
  grupo: number;
  grupoAntigo: string;
  familia: string | null;
  bloco: Bloco;
  /** Linha na grade: 1–7 no corpo, 9 lantanídeos, 10 actinídeos. */
  linha: number;
  coluna: number;
  categoria: CategoriaKey;
  categoriaPrevista?: boolean;
  radioativo: boolean;
  massa: {
    padrao?: ValorIncerteza | { intervalo: [string, string] };
    abreviado?: ValorIncerteza;
    /** Sem peso padrão: número de massa do isótopo de vida mais longa. */
    numeroMassa?: number;
    notas?: string[];
  };
  isotopoMaisEstavel?: { a: number; meiaVida: MeiaVida | null };
  isotopos: { a: number; abundancia: string }[];
  natural: boolean;
  /** Subníveis em ordem geométrica, com a contagem ("3d6"). */
  configuracao: string[];
  configuracaoPrevista?: boolean;
  energiaIonizacao: {
    ev: string;
    incerteza?: string;
    estimado?: 'teorica' | 'semiempirica';
  } | null;
  eletronegatividade: { valor: number; estimado?: boolean } | null;
  raio: { valor: number; estimado?: boolean } | null;
  afinidade: { ev: number; estimado?: boolean } | { anionInstavel: true } | null;
  oxidacao: { todos: number[]; comuns: number[] };
  oxidacaoPrevista?: boolean;
  densidade: { valor: number; estimado?: boolean } | null;
  fusao: { k: number; estimado?: boolean } | null;
  ebulicao: { k: number; estimado?: boolean } | null;
  /** Sem ponto de fusão a 1 atm: sublima (C, As) ou não solidifica (He). */
  semFusao?: 'sublima' | 'nao-solidifica';
  estado: Estado | null;
  estadoPrevisto?: Estado;
  quimica: string;
  fontes: Record<string, string>;
}

export interface Fonte {
  nome: string;
  url: string;
  consultadoEm?: string;
}

export interface Catalogo {
  conferidoEm: string;
  revisaoCiaaw: string;
  familias: Record<CategoriaKey, string>;
  fontes: Record<string, Fonte>;
  elementos: Elemento[];
}

export const CATEGORIAS: { key: CategoriaKey; rotulo: string; plural: string }[] = [
  { key: 'alcalino', rotulo: 'Metal alcalino', plural: 'Metais alcalinos' },
  { key: 'alcalino-terroso', rotulo: 'Metal alcalino-terroso', plural: 'Metais alcalino-terrosos' },
  { key: 'transicao', rotulo: 'Metal de transição', plural: 'Metais de transição' },
  { key: 'lantanideo', rotulo: 'Lantanídeo', plural: 'Lantanídeos' },
  { key: 'actinideo', rotulo: 'Actinídeo', plural: 'Actinídeos' },
  { key: 'pos-transicao', rotulo: 'Metal representativo', plural: 'Metais representativos' },
  { key: 'semimetal', rotulo: 'Semimetal', plural: 'Semimetais' },
  { key: 'nao-metal', rotulo: 'Não metal', plural: 'Não metais' },
  { key: 'halogenio', rotulo: 'Halogênio', plural: 'Halogênios' },
  { key: 'gas-nobre', rotulo: 'Gás nobre', plural: 'Gases nobres' },
];

const ROTULO_CATEGORIA = Object.fromEntries(CATEGORIAS.map((c) => [c.key, c.rotulo])) as Record<
  CategoriaKey,
  string
>;

export function rotuloCategoria(e: Pick<Elemento, 'categoria' | 'categoriaPrevista'>): string {
  const r = ROTULO_CATEGORIA[e.categoria];
  return e.categoriaPrevista ? `${r} (previsto)` : r;
}

export const ROTULO_ESTADO: Record<Estado, string> = {
  solido: 'Sólido',
  liquido: 'Líquido',
  gasoso: 'Gasoso',
};

/** "Ferro, número atômico 26, metal de transição": o que o leitor de tela diz. */
export function descricaoAcessivel(e: Elemento): string {
  return `${e.nome}, número atômico ${e.z}, ${rotuloCategoria(e).toLowerCase()}`;
}

// ---------------------------------------------------------------------------
// Busca e filtros

/** Minúsculas, sem acento e sem espaço nas pontas. */
export function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/**
 * Elementos que combinam com a busca, do melhor para o pior: número atômico ou
 * símbolo exatos, depois nome (em português, variantes e inglês) que começa
 * com o termo, e por fim nome que contém o termo (a partir de 3 letras).
 * "potassio", "k" e "19" acham o potássio.
 */
export function buscar(lista: Elemento[], termo: string): Elemento[] {
  const t = normalizar(termo);
  if (!t) return [];
  const pontos = (e: Elemento): number => {
    if (/^\d+$/.test(t)) return Number(t) === e.z ? 4 : 0;
    if (normalizar(e.simbolo) === t) return 4;
    const nomes = [e.nome, ...(e.variantes ?? []), e.nomeEn].map(normalizar);
    if (nomes.some((n) => n === t)) return 3;
    if (nomes.some((n) => n.startsWith(t))) return 2;
    if (t.length >= 3 && nomes.some((n) => n.includes(t))) return 1;
    return 0;
  };
  return lista
    .map((e) => ({ e, p: pontos(e) }))
    .filter((x) => x.p > 0)
    .sort((a, b) => b.p - a.p || a.e.z - b.e.z)
    .map((x) => x.e);
}

export interface Filtros {
  grupo?: number;
  periodo?: number;
  bloco?: Bloco;
  categoria?: CategoriaKey;
}

export function temFiltro(f: Filtros): boolean {
  return f.grupo != null || f.periodo != null || f.bloco != null || f.categoria != null;
}

/** O elemento passa em todos os filtros ligados (eles se cruzam). */
export function passaFiltro(e: Elemento, f: Filtros): boolean {
  if (f.grupo != null && e.grupo !== f.grupo) return false;
  if (f.periodo != null && e.periodo !== f.periodo) return false;
  if (f.bloco != null && e.bloco !== f.bloco) return false;
  if (f.categoria != null && e.categoria !== f.categoria) return false;
  return true;
}

/** Numeração antiga (1A–8A, famílias B), que livros e vestibulares ainda usam. */
export function grupoTexto(e: Pick<Elemento, 'grupo' | 'grupoAntigo' | 'bloco'>): string {
  if (e.bloco === 'f') return `${e.grupo} (${e.grupoAntigo}), na série do grupo 3`;
  return `${e.grupo} (${e.grupoAntigo})`;
}

// ---------------------------------------------------------------------------
// Navegação pela grade

export type Direcao = 'esquerda' | 'direita' | 'cima' | 'baixo' | 'inicio' | 'fim';

/** Linhas da grade em ordem visual (a 8 é o respiro antes das séries f). */
const LINHAS = [1, 2, 3, 4, 5, 6, 7, 9, 10];

/**
 * Próximo elemento ao andar pela grade pelas setas: anda pela posição real,
 * pulando as casas vazias. Na borda (ou sem nada na direção), fica onde está.
 * Home e End vão ao primeiro e ao último da linha.
 */
export function mover(lista: Elemento[], z: number, direcao: Direcao): number {
  const atual = lista.find((e) => e.z === z);
  if (!atual) return z;
  const naLinha = lista.filter((e) => e.linha === atual.linha).sort((a, b) => a.coluna - b.coluna);
  switch (direcao) {
    case 'inicio':
      return naLinha[0].z;
    case 'fim':
      return naLinha[naLinha.length - 1].z;
    case 'esquerda':
      return [...naLinha].reverse().find((e) => e.coluna < atual.coluna)?.z ?? z;
    case 'direita':
      return naLinha.find((e) => e.coluna > atual.coluna)?.z ?? z;
    case 'cima':
    case 'baixo': {
      const i = LINHAS.indexOf(atual.linha);
      const ordem = direcao === 'cima' ? LINHAS.slice(0, i).reverse() : LINHAS.slice(i + 1);
      for (const linha of ordem) {
        const alvo = lista.find((e) => e.linha === linha && e.coluna === atual.coluna);
        if (alvo) return alvo.z;
      }
      return z;
    }
  }
}

// ---------------------------------------------------------------------------
// Números

const casasDe = (s: string) => (s.split('.')[1] ?? '').length;

/** "55.845" → "55,845"; mantém os algarismos da fonte. */
export function decimalBr(s: string): string {
  return s.replace('.', ',');
}

/** Número com vírgula decimal e no máximo `casas` casas. */
export function numeroBr(n: number, casas = 2): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: casas, useGrouping: false });
}

/** Massa que aparece na casa da grade: a abreviada da CIAAW, ou [97] nos radioativos. */
export function massaCurta(e: Elemento): string {
  if (e.massa.abreviado) return decimalBr(e.massa.abreviado.valor);
  return `[${e.massa.numeroMassa}]`;
}

/** Massa usada nas contas (calculadora de massa molar): a abreviada. */
export function massaParaConta(e: Elemento): number {
  if (e.massa.abreviado) return Number(e.massa.abreviado.valor);
  return e.massa.numeroMassa ?? Number.NaN;
}

/** "157.249" e "0.002" → "157,249(2)": a incerteza nos últimos algarismos. */
export function comIncerteza(v: ValorIncerteza): string {
  const casas = casasDe(v.valor);
  const digitos = Math.round(Number(v.incerteza) * 10 ** casas);
  return `${decimalBr(v.valor)}(${digitos})`;
}

/** 1 eV = 96,485 332 12 kJ/mol (CODATA). */
export const KJ_MOL_POR_EV = 96.48533212;

export function evParaKjMol(ev: number): number {
  return ev * KJ_MOL_POR_EV;
}

export function kelvinParaCelsius(k: number): number {
  return k - 273.15;
}

const UNIDADES_MEIA_VIDA: Record<string, [string, string]> = {
  ms: ['milissegundo', 'milissegundos'],
  s: ['segundo', 'segundos'],
  min: ['minuto', 'minutos'],
  m: ['minuto', 'minutos'],
  h: ['hora', 'horas'],
  d: ['dia', 'dias'],
  a: ['ano', 'anos'],
  Y: ['ano', 'anos'],
  ka: ['mil anos', 'mil anos'],
  Ma: ['milhão de anos', 'milhões de anos'],
};

const SOBRESCRITO: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻', '+': '⁺',
};

export function sobrescrito(s: string | number): string {
  return String(s)
    .split('')
    .map((c) => SOBRESCRITO[c] ?? c)
    .join('');
}

/** "4.21" Ma → "4,21 milhões de anos"; "2.01E19" Y → "2,01 × 10¹⁹ anos". */
export function meiaVidaTexto(mv: MeiaVida): string {
  const [um, varios] = UNIDADES_MEIA_VIDA[mv.unidade] ?? [mv.unidade, mv.unidade];
  const exp = /^([\d.]+)E\+?(-?\d+)$/i.exec(mv.valor);
  const valor = exp ? `${decimalBr(exp[1])} × 10${sobrescrito(Number(exp[2]))}` : decimalBr(mv.valor);
  // Em português o singular vai até antes do 2: "1,5 hora", "1,2 milhão de anos".
  const unidade = !exp && Number(mv.valor) < 2 ? um : varios;
  return `${mv.aproximado ? 'cerca de ' : ''}${valor} ${unidade}`;
}

/** Abundância natural "0.91754(36)" → "91,754%". */
export function abundanciaTexto(abundancia: string): string {
  const v = abundancia.replace(/\(.*\)/, '');
  const casas = Math.max(0, casasDe(v) - 2);
  return `${(Number(v) * 100).toLocaleString('pt-BR', {
    minimumFractionDigits: Math.min(casas, 4),
    maximumFractionDigits: Math.min(casas, 4),
  })}%`;
}

/** "+3", "−2", "0": o sinal de menos tipográfico. */
export function oxidacaoTexto(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0';
}

/** Nome curto de cada fonte, para a ficha ("CIAAW", "NIST"…). */
export const ROTULO_FONTE: Record<string, string> = {
  'ciaaw-padrao': 'CIAAW 2024',
  'ciaaw-abreviado': 'CIAAW 2024',
  'ciaaw-radioativos': 'CIAAW',
  'nist-asd': 'NIST',
  'nist-composicao': 'NIST',
  pubchem: 'PubChem',
  'iaea-livechart': 'IAEA',
  mendeleev: 'CRC (mendeleev)',
  'tabelaperiodica-org': 'tabelaperiodica.org',
  'fapesp-2016': 'Pesquisa FAPESP',
  'pyykko-2009': 'Pyykkö e Atsumi 2009',
  'andersen-2004': 'Andersen 2004',
  'leimbach-2020': 'Leimbach et al. 2020',
  'iupac-2022': 'IUPAC',
  openem: 'OpENEM',
};

/** "2026-10-23" → "23/10/2026". */
export function dataBr(iso: string): string {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

/** "Fe", 2 → "Fe²⁺"; "Cl", −1 → "Cl⁻". */
export function rotuloIon(simbolo: string, carga: number): string {
  if (carga === 0) return simbolo;
  const n = Math.abs(carga);
  return `${simbolo}${n > 1 ? sobrescrito(n) : ''}${carga > 0 ? '⁺' : '⁻'}`;
}
