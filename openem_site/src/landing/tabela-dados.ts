// Extração, no build, do pouco que a prévia da tabela periódica usa. O
// catálogo do app (`openem_frontend/src/data/elementos.json`, ~270 KB) tem
// isótopos, fontes e textos de química; a landing só precisa da posição, do
// símbolo, do nome, da massa e do tom de cada casa em cada modo de cor. As
// regras de cor e de escala são as do próprio app (mesmas funções), para a
// prévia não divergir da tela.
//
// Roda dentro do vite.config (plugin `virtual:tabela-periodica`); fica em
// src/ para ser testado.

import {
  CATEGORIAS,
  massaCurta,
  numeroBr,
  rotuloCategoria,
  type Catalogo,
  type CategoriaKey,
} from '../../../openem_frontend/src/lib/elementos';
import {
  escala,
  PROPRIEDADES,
  TENDENCIAS,
  tomDaCasa,
} from '../../../openem_frontend/src/lib/propriedades-periodicas';

export type ModoKey = 'categoria' | 'raio' | 'energiaIonizacao' | 'eletronegatividade';

/** Tom de uma casa num modo: sufixo do `--tp-*` (null = desconhecido), degrau e se é estimado. */
export type Tom = [tom: string | null, passo: number | null, estimado: 0 | 1];

export interface CasaDaPrevia {
  z: number;
  simbolo: string;
  nome: string;
  /** Linha na grade: 1–7 no corpo, 9 lantanídeos, 10 actinídeos. */
  linha: number;
  coluna: number;
  categoria: string;
  massa: string;
  tons: Record<ModoKey, Tom>;
  /** Valor da propriedade já formatado, com unidade (null = desconhecido). */
  valores: Record<Exclude<ModoKey, 'categoria'>, string | null>;
}

export interface ModoDaPrevia {
  key: ModoKey;
  rotulo: string;
  /** Para onde a propriedade cresce (só nas tendências). */
  periodo?: 'esquerda' | 'direita';
  grupo?: 'cima' | 'baixo';
}

export interface DadosDaPrevia {
  casas: CasaDaPrevia[];
  modos: ModoDaPrevia[];
  categorias: { key: CategoriaKey; plural: string }[];
}

const UNIDADE: Record<Exclude<ModoKey, 'categoria'>, (v: number) => string> = {
  raio: (v) => `${numeroBr(v, 0)} pm`,
  energiaIonizacao: (v) => `${numeroBr(v, 0)} kJ/mol`,
  eletronegatividade: (v) => numeroBr(v, 2),
};

export function enxugarCatalogo(catalogo: Pick<Catalogo, 'elementos'>): DadosDaPrevia {
  const lista = catalogo.elementos;
  const tendencias = TENDENCIAS.map((t) => {
    const p = PROPRIEDADES.find((x) => x.key === t.key)!;
    return { t, p, esc: escala(lista.map(p.valor), p.log) };
  });

  const casas = lista.map((e): CasaDaPrevia => {
    const cat = tomDaCasa(e, { tipo: 'categoria' });
    const tons = { categoria: [cat.tom, null, cat.estimado ? 1 : 0] } as Record<ModoKey, Tom>;
    const valores = {} as CasaDaPrevia['valores'];
    for (const { t, p, esc } of tendencias) {
      const tom = tomDaCasa(e, { tipo: 'calor', propriedade: t.key }, esc);
      tons[t.key] = [tom.tom, tom.passo, tom.estimado ? 1 : 0];
      const v = p.valor(e);
      valores[t.key] = v == null ? null : UNIDADE[t.key](v);
    }
    return {
      z: e.z,
      simbolo: e.simbolo,
      nome: e.nome,
      linha: e.linha,
      coluna: e.coluna,
      categoria: rotuloCategoria(e),
      massa: massaCurta(e),
      tons,
      valores,
    };
  });

  return {
    casas,
    modos: [
      { key: 'categoria', rotulo: 'Categorias' },
      ...TENDENCIAS.map(({ key, rotulo, periodo, grupo }) => ({ key, rotulo, periodo, grupo })),
    ],
    categorias: CATEGORIAS.map(({ key, plural }) => ({ key, plural })),
  };
}
