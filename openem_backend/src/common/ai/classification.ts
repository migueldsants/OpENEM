/**
 * Classificação de matéria/assunto das questões oficiais do ENEM.
 *
 * O dataset traz só a área do conhecimento. Revisão espaçada, mapa de calor e
 * recomendação trabalham por ASSUNTO, então enquanto a questão não é
 * classificada ela fica de fora desses recursos. Aqui ficam o prompt, o schema
 * e a validação; o job que percorre o banco está em
 * `prisma/classify-questions-lib.ts`.
 */

/** Um assunto elegível dentro da área, com o rótulo único mostrado à IA. */
export interface TopicOption {
  topicId: string;
  subjectName: string;
  topicName: string;
}

export interface QuestionToClassify {
  id: string;
  statement: string;
  questionPrompt: string | null;
}

export interface ClassificationDecision {
  questionId: string;
  topicId: string | null;
  confidence: number;
}

/**
 * Matérias que nunca são resposta para uma questão objetiva: Redação é a prova
 * discursiva, e Língua Estrangeira já chega classificada pelo próprio dataset
 * (campo `language`). Deixá-las no cardápio só abriria espaço para erro — uma
 * interpretação de texto em português parece muito com uma de inglês.
 */
export const EXCLUDED_SUBJECTS = new Set(['Redação', 'Língua Estrangeira']);

/** Enunciado cortado: área + começo do texto bastam para achar o assunto. */
export const MAX_STATEMENT_CHARS = 1200;

export const CLASSIFICATION_SYSTEM_PROMPT = `Você classifica questões do ENEM \
por assunto. Para cada questão, escolha na lista o assunto que ela avalia \
principalmente, e informe sua confiança de 0 a 1.

- Escolha SEMPRE um item da lista, exatamente como está escrito.
- Questões interdisciplinares: escolha o assunto que o comando da questão cobra.
- Se estiver em dúvida entre dois assuntos, escolha o mais provável e baixe a \
confiança. Não invente assuntos fora da lista.`;

/**
 * Rótulo único do assunto. Na mesma área, nomes se repetem entre matérias
 * ("Movimentos sociais" em História e em Sociologia), então só o nome não
 * identifica o assunto.
 */
export function topicLabel(o: Pick<TopicOption, 'subjectName' | 'topicName'>) {
  return `${o.subjectName} / ${o.topicName}`;
}

/** Remove imagens e excesso de espaço, e corta no limite. */
export function compactStatement(texto: string): string {
  const semImagens = texto
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '[figura]')
    .replace(/\s+/g, ' ')
    .trim();
  return semImagens.length > MAX_STATEMENT_CHARS
    ? `${semImagens.slice(0, MAX_STATEMENT_CHARS)}…`
    : semImagens;
}

/** Schema da resposta, com o enum restrito aos assuntos válidos da área. */
export function buildClassificationSchema(options: TopicOption[]) {
  return {
    type: 'object',
    properties: {
      results: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            ref: { type: 'string' },
            topic: { type: 'string', enum: options.map(topicLabel) },
            confidence: { type: 'number' },
          },
          required: ['ref', 'topic', 'confidence'],
          additionalProperties: false,
        },
      },
    },
    required: ['results'],
    additionalProperties: false,
  };
}

/**
 * Mensagem do usuário. As questões recebem referências curtas ("q1", "q2")
 * em vez do id do banco: menos tokens e menos chance de o modelo errar a cópia.
 */
export function buildClassificationPrompt(
  areaName: string,
  questions: QuestionToClassify[],
): string {
  const blocos = questions.map((q, i) => {
    const comando = q.questionPrompt
      ? `\nComando: ${compactStatement(q.questionPrompt)}`
      : '';
    return `[q${i + 1}]\n${compactStatement(q.statement)}${comando}`;
  });
  return `Área: ${areaName}\n\n${blocos.join('\n\n')}`;
}

/**
 * Valida a resposta e a traduz em decisões por questão. Nada que venha da IA é
 * confiado sem conferência: referência desconhecida, assunto fora da lista ou
 * confiança inválida viram "sem decisão" para aquela questão — nunca um
 * assunto errado gravado.
 */
export function parseClassification(
  raw: string,
  questions: QuestionToClassify[],
  options: TopicOption[],
): ClassificationDecision[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Resposta da IA não é JSON válido');
  }
  const results =
    parsed && typeof parsed === 'object' && 'results' in parsed
      ? (parsed as { results: unknown }).results
      : undefined;
  if (!Array.isArray(results)) {
    throw new Error('Resposta da IA sem a lista de resultados');
  }

  const porRotulo = new Map(options.map((o) => [topicLabel(o), o.topicId]));
  const decisoes = new Map<string, ClassificationDecision>();

  for (const item of results) {
    if (!item || typeof item !== 'object') continue;
    const { ref, topic, confidence } = item as Record<string, unknown>;
    const indice =
      typeof ref === 'string'
        ? Number.parseInt(ref.replace(/^q/, ''), 10) - 1
        : -1;
    const questao = questions[indice];
    if (!questao || decisoes.has(questao.id)) continue;

    const topicId =
      typeof topic === 'string' ? porRotulo.get(topic) : undefined;
    const conf =
      typeof confidence === 'number' ? confidence : Number(confidence);
    decisoes.set(questao.id, {
      questionId: questao.id,
      topicId: topicId ?? null,
      confidence: Number.isFinite(conf) ? Math.min(1, Math.max(0, conf)) : 0,
    });
  }

  // Questão que a IA pulou também conta como tentativa sem decisão.
  return questions.map(
    (q) =>
      decisoes.get(q.id) ?? { questionId: q.id, topicId: null, confidence: 0 },
  );
}
