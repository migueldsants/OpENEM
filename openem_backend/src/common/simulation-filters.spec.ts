import {
  buildQuestionWhere,
  describeFilters,
  hasContentFilter,
  MAX_QUESTIONS,
  MIN_QUESTIONS,
  normalizeFilters,
  parseFilters,
  resolveTimeLimit,
  serializeFilters,
} from './simulation-filters';

describe('normalizeFilters', () => {
  it('sem entrada devolve filtro vazio', () => {
    expect(normalizeFilters(null)).toEqual({});
    expect(normalizeFilters(undefined)).toEqual({});
  });

  it('aceita os campos no singular da API antiga', () => {
    expect(
      normalizeFilters({ subjectId: 's1', topicId: 't1', examSlug: '2023' }),
    ).toEqual({ subjectIds: ['s1'], topicIds: ['t1'], examSlugs: ['2023'] });
  });

  it('junta singular com plural sem repetir', () => {
    expect(
      normalizeFilters({ subjectIds: ['s1', 's2'], subjectId: 's1' })
        .subjectIds,
    ).toEqual(['s1', 's2']);
  });

  it('descarta id vazio e espaço', () => {
    expect(normalizeFilters({ topicIds: ['', '  ', 't1'] }).topicIds).toEqual([
      't1',
    ]);
    expect(normalizeFilters({ topicIds: [] }).topicIds).toBeUndefined();
  });

  it('limita a quantidade de questões à faixa permitida', () => {
    expect(normalizeFilters({ questionCount: 1 }).questionCount).toBe(
      MIN_QUESTIONS,
    );
    expect(normalizeFilters({ questionCount: 999 }).questionCount).toBe(
      MAX_QUESTIONS,
    );
    expect(normalizeFilters({ questionCount: 20.7 }).questionCount).toBe(20);
  });

  it('ordena a faixa de anos invertida em vez de ignorá-la', () => {
    expect(normalizeFilters({ yearFrom: 2023, yearTo: 2015 })).toEqual({
      yearFrom: 2015,
      yearTo: 2023,
    });
  });

  it('só aceita idioma conhecido', () => {
    expect(normalizeFilters({ language: 'ingles' }).language).toBe('ingles');
    expect(normalizeFilters({ language: 'frances' }).language).toBeUndefined();
  });

  it('flags falsas não entram no objeto salvo', () => {
    expect(normalizeFilters({ pareto: false, unseenOnly: false })).toEqual({});
  });
});

// O que chega aqui nem sempre é bem formado: o template salvo é JSON no banco
// (pode vir de uma versão antiga) e o cliente manda o que quiser. Estes casos
// saíram do mutation testing: a limpeza existia, mas nada a verificava.
describe('normalizeFilters: entrada malformada', () => {
  it('id solto no lugar da lista vira lista (antes era picado em letras)', () => {
    const f = normalizeFilters({
      subjectIds: 'mat' as unknown as string[],
      examSlugs: 42 as unknown as string[],
    });
    expect(f.subjectIds).toEqual(['mat']);
    expect(f.examSlugs).toBeUndefined();
  });

  it('itens que não são texto, vazios ou repetidos saem da lista', () => {
    const f = normalizeFilters({
      topicIds: [1, null, ' t1 ', 't1', ''] as unknown as string[],
    });
    expect(f.topicIds).toEqual(['t1']);
  });

  it('template gravado com o formato errado não zera o simulado', () => {
    expect(parseFilters('{"subjectIds":"mat","questionCount":"20"}')).toEqual({
      subjectIds: ['mat'],
      questionCount: 20,
    });
  });

  it('número em texto é aceito; decimal é truncado; lixo é descartado', () => {
    const f = normalizeFilters({
      questionCount: '20' as unknown as number,
      difficulty: 2.7,
      yearFrom: 'abc' as unknown as number,
      yearTo: Infinity,
    });
    expect(f.questionCount).toBe(20);
    expect(f.difficulty).toBe(2);
    expect(f.yearFrom).toBeUndefined();
    expect(f.yearTo).toBeUndefined();
  });

  it('nível e tempo ficam presos à faixa válida', () => {
    expect(normalizeFilters({ difficulty: 9 }).difficulty).toBe(5);
    expect(normalizeFilters({ difficulty: -3 }).difficulty).toBe(1);
    expect(normalizeFilters({ timeLimitMin: 0 }).timeLimitMin).toBe(1);
    expect(normalizeFilters({ timeLimitMin: 9999 }).timeLimitMin).toBe(600);
  });

  it('só um lado da faixa de anos vale sozinho', () => {
    expect(normalizeFilters({ yearFrom: 2015 })).toEqual({ yearFrom: 2015 });
    expect(normalizeFilters({ yearTo: 2020 })).toEqual({ yearTo: 2020 });
    expect(buildQuestionWhere({ yearTo: 2020 })).toEqual({
      examYear: { year: { lte: 2020 } },
    });
    expect(describeFilters({ yearFrom: 2015 })).toBe('2015');
  });
});

describe('hasContentFilter', () => {
  it('contagem sozinha não é recorte de conteúdo', () => {
    expect(hasContentFilter({ questionCount: 10 })).toBe(false);
  });

  it('área, assunto, prova, nível e recortes pessoais são', () => {
    expect(hasContentFilter({ subjectAreaIds: ['a'] })).toBe(true);
    expect(hasContentFilter({ topicIds: ['t'] })).toBe(true);
    expect(hasContentFilter({ examSlugs: ['2023'] })).toBe(true);
    expect(hasContentFilter({ difficulty: 3 })).toBe(true);
    expect(hasContentFilter({ unseenOnly: true })).toBe(true);
    expect(hasContentFilter({ wrongOnly: true })).toBe(true);
  });
});

describe('resolveTimeLimit', () => {
  it('usa o tempo escolhido pelo aluno', () => {
    expect(resolveTimeLimit({ timeLimitMin: 45 }, 10)).toBe(45);
  });

  it('sem escolha, 3 minutos por questão', () => {
    expect(resolveTimeLimit({}, 20)).toBe(60);
  });

  it('nunca desce abaixo de 5 minutos', () => {
    expect(resolveTimeLimit({}, 1)).toBe(5);
  });
});

describe('buildQuestionWhere', () => {
  it('sem filtro, não restringe nada', () => {
    expect(buildQuestionWhere({})).toEqual({});
  });

  it('área, matéria e assunto se SOMAM (união), não se cruzam', () => {
    const where = buildQuestionWhere({
      subjectAreaIds: ['a1'],
      subjectIds: ['s1'],
      topicIds: ['t1'],
    });
    expect(where).toEqual({
      OR: [
        { subjectAreaId: { in: ['a1'] } },
        { topic: { subjectId: { in: ['s1'] } } },
        { topicId: { in: ['t1'] } },
      ],
    });
  });

  it('uma seleção só não vira OR de um elemento', () => {
    expect(buildQuestionWhere({ topicIds: ['t1'] })).toEqual({
      topicId: { in: ['t1'] },
    });
  });

  it('cruza conteúdo com prova e nível (AND)', () => {
    const where = buildQuestionWhere({
      topicIds: ['t1'],
      examSlugs: ['2023'],
      difficulty: 4,
    });
    expect(where.AND).toEqual([
      { topicId: { in: ['t1'] } },
      { examYear: { slug: { in: ['2023'] } } },
      { difficulty: 4 },
    ]);
  });

  it('faixa de anos vira gte/lte na prova', () => {
    expect(buildQuestionWhere({ yearFrom: 2015, yearTo: 2020 })).toEqual({
      examYear: { year: { gte: 2015, lte: 2020 } },
    });
  });

  it('idioma mantém as questões sem idioma e corta a outra versão', () => {
    expect(buildQuestionWhere({ language: 'espanhol' })).toEqual({
      OR: [{ language: null }, { language: 'espanhol' }],
    });
  });

  it('recortes pessoais exigem usuário', () => {
    expect(buildQuestionWhere({ unseenOnly: true })).toEqual({});
    expect(buildQuestionWhere({ unseenOnly: true }, 'u1')).toEqual({
      answers: { none: { userId: 'u1' } },
    });
    expect(buildQuestionWhere({ wrongOnly: true }, 'u1')).toEqual({
      answers: { some: { userId: 'u1', isCorrect: false } },
    });
    expect(buildQuestionWhere({ onlyFavorites: true }, 'u1')).toEqual({
      favorites: { some: { userId: 'u1' } },
    });
  });
});

describe('serialização', () => {
  it('ida e volta preserva os filtros', () => {
    const f = { topicIds: ['t1'], questionCount: 15, pareto: true };
    expect(parseFilters(serializeFilters(f))).toEqual(f);
  });

  it('JSON inválido vira filtro vazio, não erro', () => {
    expect(parseFilters('{ isso não é json')).toEqual({});
    expect(parseFilters('[1,2]')).toEqual({});
    expect(parseFilters(null)).toEqual({});
  });

  it('normaliza o que foi gravado por uma versão antiga', () => {
    expect(parseFilters('{"subjectId":"s1","questionCount":1}')).toEqual({
      subjectIds: ['s1'],
      questionCount: MIN_QUESTIONS,
    });
  });
});

describe('describeFilters', () => {
  it('descreve assunto e contagem', () => {
    expect(
      describeFilters(
        { questionCount: 20 },
        { topics: ['Funções'], subjects: ['Matemática'] },
      ),
    ).toBe('Funções, Matemática · 20 questões');
  });

  it('resume quando há muitos temas', () => {
    expect(describeFilters({}, { topics: ['a', 'b', 'c', 'd', 'e'] })).toBe(
      'a, b, c e mais 2',
    );
  });

  it('sem recorte, diz que é geral', () => {
    expect(describeFilters({})).toBe('Todas as áreas');
  });

  it('cita a faixa de anos e os recortes pessoais', () => {
    expect(
      describeFilters({ yearFrom: 2015, yearTo: 2020, unseenOnly: true }),
    ).toBe('2015–2020 · inéditas');
  });
});
