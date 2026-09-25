import type { Formula } from '../api';

/**
 * Seleção do caderno de fórmulas em PDF. Pura: a tela só guarda os conjuntos
 * e pergunta daqui o que entra.
 *
 * A unidade de escolha é o assunto. Marcar uma matéria marca todos os
 * assuntos dela; o "só favoritas" e as fórmulas tiradas uma a uma filtram
 * por cima. Fórmula sem assunto ganha um assunto-fantasma por matéria, para
 * também poder ser ligada e desligada.
 */

export interface TopicGroup {
  key: string;
  name: string;
  formulas: Formula[];
}

export interface SubjectGroup {
  id: string;
  name: string;
  topics: TopicGroup[];
  total: number;
}

export const SEM_ASSUNTO = 'Outras fórmulas';

export function topicKey(f: Formula): string {
  return f.topicId ?? `sem-assunto:${f.subjectId}`;
}

/** Matéria › assunto, na ordem em que a API devolve (a mesma do PDF). */
export function groupBySubject(formulas: Formula[]): SubjectGroup[] {
  const out: SubjectGroup[] = [];
  for (const f of formulas) {
    let s = out.find((x) => x.id === f.subjectId);
    if (!s) {
      s = { id: f.subjectId, name: f.subjectName, topics: [], total: 0 };
      out.push(s);
    }
    const key = topicKey(f);
    let t = s.topics.find((x) => x.key === key);
    if (!t) {
      t = { key, name: f.topicName ?? SEM_ASSUNTO, formulas: [] };
      s.topics.push(t);
    }
    t.formulas.push(f);
    s.total++;
  }
  return out;
}

export type SubjectState = 'all' | 'some' | 'none';

export function subjectState(s: SubjectGroup, topics: Set<string>): SubjectState {
  const on = s.topics.filter((t) => topics.has(t.key)).length;
  return on === 0 ? 'none' : on === s.topics.length ? 'all' : 'some';
}

/** Matéria inteira liga; se já estava toda ligada, desliga. */
export function toggleSubject(s: SubjectGroup, topics: Set<string>): Set<string> {
  const next = new Set(topics);
  const ligar = subjectState(s, topics) !== 'all';
  for (const t of s.topics) {
    if (ligar) next.add(t.key);
    else next.delete(t.key);
  }
  return next;
}

export function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

/** O que vai para o PDF, na ordem da lista. */
export function selectedFormulas(
  formulas: Formula[],
  topics: Set<string>,
  onlyFavorites: boolean,
  excluded: Set<string>,
): Formula[] {
  return formulas.filter(
    (f) =>
      topics.has(topicKey(f)) &&
      (!onlyFavorites || f.favorited) &&
      !excluded.has(f.id),
  );
}
