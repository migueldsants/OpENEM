// Converte as anotações cruas do modelo (que só citam o trecho) em destaques
// posicionados sobre o texto da redação: acha cada trecho no conteúdo, calcula
// start/end e remove sobreposições para que o front renderize destaques não
// aninhados. Trechos não encontrados são mantidos (sem offsets) para ainda
// aparecerem na lista por competência.

import { RawAnnotation } from './shared';

export interface ResolvedAnnotation {
  competency: number; // 1..5
  start: number | null; // índice no conteúdo (null = não localizado)
  end: number | null;
  excerpt: string;
  comment: string;
  suggestion: string;
}

/** Normaliza espaços/quebras para comparar trechos de forma tolerante. */
function squash(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Localiza `excerpt` em `content`. Tenta correspondência exata primeiro
 * (avançando o cursor para lidar com repetições); se falhar, faz uma busca
 * tolerante a espaços/maiúsculas. Retorna [start, end] ou null.
 */
function findExcerpt(
  content: string,
  excerpt: string,
  fromIndex: number,
): [number, number] | null {
  const trimmed = excerpt.trim();
  if (!trimmed) return null;

  const exact = content.indexOf(trimmed, fromIndex);
  if (exact !== -1) return [exact, exact + trimmed.length];

  // Tolerante: compara versões "squashed" deslizando uma janela de tamanho
  // aproximado ao do trecho. Barato o suficiente para textos de redação.
  const needle = squash(trimmed);
  if (!needle) return null;
  for (let i = fromIndex; i < content.length; i++) {
    // janela um pouco maior que o trecho para absorver espaços extras
    const windowEnd = Math.min(content.length, i + trimmed.length + 20);
    if (squash(content.slice(i, windowEnd)).startsWith(needle)) {
      // refina o fim: menor janela cujo squash ainda começa com needle
      for (let j = i + 1; j <= windowEnd; j++) {
        if (squash(content.slice(i, j)) === needle) return [i, j];
      }
      return [i, windowEnd];
    }
  }
  return null;
}

export function resolveAnnotations(
  content: string,
  raw: RawAnnotation[],
): ResolvedAnnotation[] {
  let cursor = 0;
  const located: ResolvedAnnotation[] = [];
  const unlocated: ResolvedAnnotation[] = [];

  for (const a of raw) {
    const base: ResolvedAnnotation = {
      competency: a.competency,
      start: null,
      end: null,
      excerpt: a.excerpt,
      comment: a.comment,
      suggestion: a.suggestion,
    };
    const hit = findExcerpt(content, a.excerpt, cursor);
    if (hit) {
      cursor = hit[1];
      located.push({ ...base, start: hit[0], end: hit[1] });
    } else {
      unlocated.push(base);
    }
  }

  // Remove sobreposições entre destaques localizados (mantém o que começa antes).
  located.sort((x, y) => (x.start ?? 0) - (y.start ?? 0));
  const kept: ResolvedAnnotation[] = [];
  let lastEnd = -1;
  for (const a of located) {
    if ((a.start ?? 0) >= lastEnd) {
      kept.push(a);
      lastEnd = a.end ?? lastEnd;
    } else {
      // sobrepõe um destaque já aceito: mantém como não-localizado (sem offsets)
      unlocated.push({ ...a, start: null, end: null });
    }
  }

  return [...kept, ...unlocated];
}
