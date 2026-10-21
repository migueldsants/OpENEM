import {
  aiClassificationSource,
  buildClassificationPrompt,
  buildClassificationSchema,
  compactStatement,
  MAX_STATEMENT_CHARS,
  parseClassification,
  QuestionToClassify,
  TopicOption,
  topicLabel,
} from './classification';

const OPCOES: TopicOption[] = [
  {
    topicId: 't-hist',
    subjectName: 'História',
    topicName: 'Movimentos sociais',
  },
  {
    topicId: 't-soc',
    subjectName: 'Sociologia',
    topicName: 'Movimentos sociais',
  },
  { topicId: 't-geo', subjectName: 'Geografia', topicName: 'Urbanização' },
];

const QUESTOES: QuestionToClassify[] = [
  { id: 'cuid-a', statement: 'Texto A', questionPrompt: null },
  { id: 'cuid-b', statement: 'Texto B', questionPrompt: 'Comando B?' },
];

describe('aiClassificationSource', () => {
  it('grava o provedor que classificou', () => {
    expect(aiClassificationSource('gemini')).toBe('ai:gemini');
  });

  it('sem provedor conhecido, fica só "ai"', () => {
    expect(aiClassificationSource(null)).toBe('ai');
    expect(aiClassificationSource(undefined)).toBe('ai');
  });
});

describe('topicLabel', () => {
  it('desambigua assuntos de mesmo nome em matérias diferentes', () => {
    expect(topicLabel(OPCOES[0])).toBe('História / Movimentos sociais');
    expect(topicLabel(OPCOES[1])).toBe('Sociologia / Movimentos sociais');
  });
});

describe('buildClassificationSchema', () => {
  it('restringe o assunto ao enum de rótulos válidos da área', () => {
    const schema = buildClassificationSchema(OPCOES);
    const topic = (schema.properties.results.items.properties as any).topic;
    expect(topic.enum).toEqual([
      'História / Movimentos sociais',
      'Sociologia / Movimentos sociais',
      'Geografia / Urbanização',
    ]);
  });
});

describe('compactStatement', () => {
  it('troca imagens por um marcador — a IA não as vê', () => {
    expect(compactStatement('Veja ![](/media/enem/x.png) aqui')).toBe(
      'Veja [figura] aqui',
    );
  });

  it('corta enunciados longos', () => {
    const out = compactStatement('a'.repeat(MAX_STATEMENT_CHARS * 2));
    expect(out.length).toBe(MAX_STATEMENT_CHARS + 1);
  });
});

describe('buildClassificationPrompt', () => {
  it('usa referências curtas no lugar do id do banco', () => {
    const prompt = buildClassificationPrompt('Ciências Humanas', QUESTOES);
    expect(prompt).toContain('[q1]');
    expect(prompt).toContain('[q2]');
    expect(prompt).not.toContain('cuid-a');
    expect(prompt).toContain('Comando: Comando B?');
  });
});

describe('parseClassification', () => {
  function resposta(results: unknown[]) {
    return JSON.stringify({ results });
  }

  it('traduz referência e rótulo de volta para os ids', () => {
    const out = parseClassification(
      resposta([
        {
          ref: 'q1',
          topic: 'Sociologia / Movimentos sociais',
          confidence: 0.9,
        },
        { ref: 'q2', topic: 'Geografia / Urbanização', confidence: 0.7 },
      ]),
      QUESTOES,
      OPCOES,
    );
    expect(out).toEqual([
      { questionId: 'cuid-a', topicId: 't-soc', confidence: 0.9 },
      { questionId: 'cuid-b', topicId: 't-geo', confidence: 0.7 },
    ]);
  });

  it('assunto fora da lista vira "sem decisão", nunca um palpite gravado', () => {
    const [a] = parseClassification(
      resposta([{ ref: 'q1', topic: 'Astrologia / Signos', confidence: 0.99 }]),
      QUESTOES,
      OPCOES,
    );
    expect(a.topicId).toBeNull();
  });

  it('questão pulada pela IA também conta como sem decisão', () => {
    const out = parseClassification(
      resposta([
        { ref: 'q1', topic: 'Geografia / Urbanização', confidence: 0.8 },
      ]),
      QUESTOES,
      OPCOES,
    );
    expect(out[1]).toEqual({
      questionId: 'cuid-b',
      topicId: null,
      confidence: 0,
    });
  });

  it('ignora referência inexistente e respostas duplicadas', () => {
    const out = parseClassification(
      resposta([
        { ref: 'q9', topic: 'Geografia / Urbanização', confidence: 1 },
        { ref: 'q1', topic: 'Geografia / Urbanização', confidence: 0.8 },
        { ref: 'q1', topic: 'História / Movimentos sociais', confidence: 0.9 },
      ]),
      QUESTOES,
      OPCOES,
    );
    // Vale a primeira resposta para q1.
    expect(out[0].topicId).toBe('t-geo');
  });

  it('limita a confiança ao intervalo 0..1', () => {
    const out = parseClassification(
      resposta([
        { ref: 'q1', topic: 'Geografia / Urbanização', confidence: 7 },
        { ref: 'q2', topic: 'Geografia / Urbanização', confidence: 'abc' },
      ]),
      QUESTOES,
      OPCOES,
    );
    expect(out[0].confidence).toBe(1);
    expect(out[1].confidence).toBe(0);
  });

  it('rejeita resposta que não é JSON ou não tem a lista', () => {
    expect(() => parseClassification('xyz', QUESTOES, OPCOES)).toThrow();
    expect(() =>
      parseClassification('{"outra":1}', QUESTOES, OPCOES),
    ).toThrow();
  });
});
