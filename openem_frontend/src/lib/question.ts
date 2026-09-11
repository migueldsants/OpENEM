import type { AreaRef, Question, TopicRef } from '../api';

/**
 * Rótulos de uma questão.
 *
 * A maior parte do banco vem das provas oficiais do ENEM, que entram
 * classificadas apenas na ÁREA do conhecimento — a matéria e o assunto só
 * aparecem depois. Estas funções concentram esse "melhor rótulo disponível"
 * num lugar só, em vez de espalhar `?.` por cada tela.
 */

type ComTaxonomia = {
  topic: TopicRef | null;
  subjectArea?: AreaRef | null;
};

/** O nome usado para a cor da área: matéria quando houver, senão a área. */
export function areaSourceName(q: ComTaxonomia): string {
  return q.topic?.subject.name ?? q.subjectArea?.name ?? '';
}

/**
 * Rótulo principal: a matéria ("Matemática") quando classificada, senão a
 * área, sem o "e suas Tecnologias" que só ocupa espaço no celular.
 */
export function subjectLabel(q: ComTaxonomia): string {
  const nome = areaSourceName(q);
  return nome.replace(' e suas Tecnologias', '') || 'Sem matéria';
}

/** Rótulo secundário: o assunto, quando a questão já foi classificada. */
export function topicLabel(q: ComTaxonomia): string | null {
  return q.topic?.name ?? null;
}

/**
 * Identificação da questão: o código oficial ("ENEM-2023-136") ou, sem ele,
 * o nome da prova.
 */
export function codeLabel(q: {
  code?: string | null;
  examYear?: Question['examYear'];
}): string | null {
  return q.code ?? q.examYear?.label ?? null;
}

/**
 * Normaliza o que o aluno digita na busca por código — espelho de
 * `normalizeCodeQuery` do backend, usado para filtrar as favoritas em memória.
 * "2023 7" → "ENEM-2023-007".
 */
export function normalizeCodeQuery(input: string): string {
  const partes = input
    .trim()
    .toUpperCase()
    .split(/[\s_/.-]+/)
    .filter(Boolean);
  if (partes[0] === 'ENEM') partes.shift();
  const [ano, numero, ...resto] = partes;
  const saida = ['ENEM'];
  if (ano) saida.push(ano);
  if (numero) {
    saida.push(/^\d{1,2}$/.test(numero) ? numero.padStart(3, '0') : numero);
  }
  saida.push(...resto);
  return saida.join('-');
}

/**
 * O nível só é informativo quando alguém o calibrou. As questões oficiais
 * entram todas no valor padrão (3), e mostrar "nível 3" em 4 mil questões
 * seria desinformação — melhor mostrar a prova.
 */
export function hasCalibratedDifficulty(q: {
  source?: string;
  difficulty: number;
}): boolean {
  return q.source !== 'ENEM_DEV';
}
