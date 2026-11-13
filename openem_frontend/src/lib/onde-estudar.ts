// Lógica pura da tela Onde estudar (discussão #126): busca, filtro por
// matéria, agrupamento e a checagem final de cada link antes de virar <a>.
// O catálogo e as regras de verdade ficam no backend
// (`openem_backend/src/study-resources/`); aqui é a segunda trava.

import type { StudyResource, StudyResourceType } from '../api';
import { semAcento } from './redacoes';
import { DOCS_URL, TERMOS_URL } from './site';

/** Seção dos Termos de Uso sobre links de outros sites (canal de remoção). */
export const TERMOS_LINKS_URL = `${TERMOS_URL}#links-e-materiais-de-outros-sites`;
/** Guia de quem quer sugerir um material. */
export const GUIA_MATERIAIS_URL = `${DOCS_URL}contribuir/materiais-gratuitos/`;

export const ROTULO_TIPO: Record<StudyResourceType, string> = {
  curso: 'Curso',
  videoaulas: 'Videoaulas',
  exercicios: 'Exercícios',
  livros: 'Livros',
  acervo: 'Acervo',
  simulador: 'Simulador',
  dicionario: 'Dicionário',
  documento: 'Documento oficial',
};

export const ROTULO_INSTITUICAO: Record<StudyResource['provider']['kind'], string> = {
  publico: 'Instituição pública',
  'sem-fins-lucrativos': 'Sem fins lucrativos',
};

export const ROTULO_IDIOMA: Partial<Record<StudyResource['language'], string>> = {
  en: 'Em inglês',
  es: 'Em espanhol',
};

/** Ordem das matérias na tela: por área, como no resto do app. */
export const ORDEM_MATERIAS = [
  'Matemática',
  'Física',
  'Química',
  'Biologia',
  'História',
  'Geografia',
  'Filosofia',
  'Sociologia',
  'Língua Portuguesa',
  'Literatura',
  'Redação',
  'Língua Estrangeira',
  'Artes',
  'Educação Física',
];

function posicao(materia: string): number {
  const i = ORDEM_MATERIAS.indexOf(materia);
  return i < 0 ? ORDEM_MATERIAS.length : i;
}

function porOrdem(a: string, b: string): number {
  return posicao(a) - posicao(b) || a.localeCompare(b, 'pt-BR');
}

/**
 * O endereço pode virar link? Só https, sem usuário/senha embutidos. O
 * backend já garante isso; a tela confere de novo para que um catálogo
 * adulterado nunca vire `javascript:` ou `http:` no navegador do aluno.
 */
export function linkSeguro(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' || u.username || u.password) return null;
    return u.href;
  } catch {
    return null;
  }
}

/** Host para mostrar ao lado do botão: o aluno vê para onde vai antes de clicar. */
export function hostDe(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** 2026-11-13 → 13/11/2026. */
export function dataCurta(iso: string): string {
  const [a, m, d] = iso.split('-');
  return a && m && d ? `${d}/${m}/${a}` : iso;
}

/** Matérias que têm material, na ordem da tela. */
export function materiasComMaterial(recursos: readonly StudyResource[]): string[] {
  return [...new Set(recursos.flatMap((r) => r.subjects))].sort(porOrdem);
}

function texto(r: StudyResource): string {
  return semAcento(
    [r.title, r.description, r.provider.name, ...r.subjects, ...r.topics].join(' '),
  );
}

/**
 * Filtra por busca (sem acento, todas as palavras) e por matéria. O material
 * "para todas as matérias" aparece em qualquer matéria escolhida.
 */
export function filtrar(
  recursos: readonly StudyResource[],
  { termo, materia }: { termo: string; materia: string },
): StudyResource[] {
  const palavras = semAcento(termo).split(/\s+/).filter(Boolean);
  return recursos.filter((r) => {
    if (materia && r.subjects.length > 0 && !r.subjects.includes(materia)) return false;
    if (!palavras.length) return true;
    const t = texto(r);
    return palavras.every((p) => t.includes(p));
  });
}

export interface GrupoDeMateria {
  /** null = para todas as matérias. */
  materia: string | null;
  recursos: StudyResource[];
}

/**
 * Agrupa por matéria, na ordem da tela, com "para todas" no topo. Material de
 * duas matérias aparece nas duas; com uma matéria escolhida, só nela.
 */
export function agrupar(
  recursos: readonly StudyResource[],
  materia = '',
): GrupoDeMateria[] {
  const grupos: GrupoDeMateria[] = [];
  const gerais = recursos.filter((r) => r.subjects.length === 0);
  if (gerais.length) grupos.push({ materia: null, recursos: gerais });
  const materias = materia ? [materia] : materiasComMaterial(recursos);
  for (const m of materias) {
    const doGrupo = recursos.filter((r) => r.subjects.includes(m));
    if (doGrupo.length) grupos.push({ materia: m, recursos: doGrupo });
  }
  return grupos;
}
