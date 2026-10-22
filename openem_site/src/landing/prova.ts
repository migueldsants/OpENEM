/**
 * O caderno da hero: como foi a prova de cada ano. Espelha as regras do
 * importador (openem_backend/src/common/enem-import/mapping.ts): até 2008, uma
 * prova única de 63 questões; desde 2009, dois dias de 90 questões, com a ordem
 * das áreas mudando em 2010 e em 2017 (quando a redação passou para o 1º dia).
 */

import type { AnoDoArquivo } from './anos';

export type Area = 'lin' | 'hum' | 'nat' | 'mat';

export const NOME_DA_AREA: Record<Area, string> = {
  lin: 'Linguagens',
  hum: 'Humanas',
  nat: 'Natureza',
  mat: 'Matemática',
};

export interface DiaDeProva {
  dia: 1 | 2;
  areas: Area[];
  redacao: boolean;
}

export interface ProvaDoAno {
  ano: number;
  unica: boolean;
  formato: string;
  questoes: string;
  /** Vazio na prova única: ela não tinha as quatro áreas. */
  dias: DiaDeProva[];
}

export const PRIMEIRO_ANO = 1998;
export const ULTIMO_ANO = 2025;

export const ANOS_DO_ENEM: number[] = Array.from(
  { length: ULTIMO_ANO - PRIMEIRO_ANO + 1 },
  (_, i) => PRIMEIRO_ANO + i,
);

function blocos(ano: number): Area[] {
  if (ano >= 2017) return ['lin', 'hum', 'nat', 'mat'];
  if (ano === 2009) return ['nat', 'hum', 'lin', 'mat'];
  return ['hum', 'nat', 'lin', 'mat'];
}

export function provaDoAno(ano: number): ProvaDoAno {
  if (ano <= 2008) {
    return {
      ano,
      unica: true,
      formato: 'Prova única',
      questoes: '63 questões interdisciplinares e redação, em um dia de 5 horas.',
      dias: [],
    };
  }
  const b = blocos(ano);
  const redacaoNoPrimeiro = ano >= 2017;
  return {
    ano,
    unica: false,
    formato: 'Dois dias',
    questoes: '180 questões e redação.',
    dias: [
      { dia: 1, areas: b.slice(0, 2), redacao: redacaoNoPrimeiro },
      { dia: 2, areas: b.slice(2), redacao: !redacaoNoPrimeiro },
    ],
  };
}

/** Tema da aplicação regular do ano; null quando o caderno não tem frase-tema (2008). */
export function temaRegular(anos: AnoDoArquivo[], ano: number): string | null {
  const t = anos.find((a) => a.ano === ano)?.temas.find((x) => x.aplicacao === 'regular');
  return t?.tema.trim() ? t.tema : null;
}
