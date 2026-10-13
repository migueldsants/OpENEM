// Núcleo puro da tela de Redações: tipos do catálogo de propostas oficiais
// (`src/data/redacoes.json`, gerado por `tools/enem-fix/redacao`) e os filtros
// da lista. Fica separado da página para ser testado sem React.

export type Aplicacao =
  | 'regular'
  | 'ppl'
  | 'digital'
  | 'segunda'
  | 'terceira'
  | 'belem';

/** Trecho de texto com o negrito (`b`) e o itálico (`i`) que tem no caderno. */
export interface ParteTexto {
  t: string;
  b?: boolean;
  i?: boolean;
}

export type BlocoRedacao =
  | {
      t: 'titulo' | 'p' | 'verso' | 'fonte';
      texto: string;
      /** Só quando o bloco tem negrito ou itálico; junta dá `texto`. */
      partes?: ParteTexto[];
    }
  | { t: 'img'; src: string; alt: string; w: number; h: number };

export interface TextoMotivador {
  /** "Texto I"… como no caderno; vazio nos cadernos que não numeram os textos. */
  rotulo: string;
  blocos: BlocoRedacao[];
}

export interface PropostaRedacao {
  id: string;
  ano: number;
  aplicacao: Aplicacao;
  aplicacaoRotulo: string;
  /** A frase-tema, com a grafia do caderno. Vazia se o caderno não tem uma. */
  tema: string;
  /** O comando da proposta, como está no caderno. */
  proposta: string;
  propostaPartes?: ParteTexto[];
  textos: TextoMotivador[];
  /** Fac-símile da página da proposta, inteira, como está no caderno. */
  paginas: { src: string; w: number; h: number }[];
  /** Caderno oficial do INEP de onde a proposta foi extraída. */
  fonteUrl: string;
  /** O caderno não traz uma frase-tema (2008): `tema` fica vazio. */
  semTema?: boolean;
}

/** Filtro da lista: tudo, só a aplicação regular ou só as demais. */
export type FiltroAplicacao = 'todas' | 'regular' | 'outras';

export const FILTROS: { key: FiltroAplicacao; label: string }[] = [
  { key: 'todas', label: 'Todas' },
  { key: 'regular', label: 'Aplicação regular' },
  { key: 'outras', label: 'PPL e outras aplicações' },
];

/**
 * O que identifica a proposta na lista: o tema ou, quando o caderno não tem
 * frase-tema, o próprio comando. Nunca um título inventado.
 */
export function tituloDaProposta(p: PropostaRedacao): string {
  return p.tema || p.proposta;
}

/** Minúsculas e sem acento, para a busca não depender de digitar "ç" e "ã". */
export function semAcento(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * Filtra por aplicação e por busca. A busca aceita o ano ("2019") ou pedaços
 * do tema; todas as palavras digitadas precisam aparecer.
 */
export function filtrarPropostas(
  lista: PropostaRedacao[],
  filtro: FiltroAplicacao,
  busca: string,
): PropostaRedacao[] {
  const termos = semAcento(busca).split(/\s+/).filter(Boolean);
  return lista.filter((p) => {
    if (filtro === 'regular' && p.aplicacao !== 'regular') return false;
    if (filtro === 'outras' && p.aplicacao === 'regular') return false;
    const alvo = semAcento(`${p.ano} ${tituloDaProposta(p)} ${p.aplicacaoRotulo}`);
    return termos.every((t) => alvo.includes(t));
  });
}

/** Agrupa por ano, do mais recente para o mais antigo, mantendo a ordem interna. */
export function agruparPorAno(
  lista: PropostaRedacao[],
): { ano: number; propostas: PropostaRedacao[] }[] {
  const porAno = new Map<number, PropostaRedacao[]>();
  for (const p of lista) {
    const grupo = porAno.get(p.ano) ?? [];
    grupo.push(p);
    porAno.set(p.ano, grupo);
  }
  return [...porAno.entries()]
    .sort(([a], [b]) => b - a)
    .map(([ano, propostas]) => ({ ano, propostas }));
}

/** Quantos textos têm figura: aparece no cartão da lista. */
export function contarFiguras(p: PropostaRedacao): number {
  return p.textos.reduce(
    (n, t) => n + t.blocos.filter((b) => b.t === 'img').length,
    0,
  );
}
