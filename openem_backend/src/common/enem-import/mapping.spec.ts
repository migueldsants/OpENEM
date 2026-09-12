import {
  areaBlocks,
  dayAreas,
  disciplineFromNumber,
  examDay,
  normalizeCodeQuery,
  officialDurationMin,
  imageRelativePath,
  mapExam,
  mapQuestion,
  questionCode,
  QuestionValidationError,
  RawQuestion,
  rewriteImageUrl,
  rewriteImageUrls,
} from './mapping';

// Fixtures sintéticas: o formato é o do dataset, o conteúdo é nosso.
function raw(overrides: Partial<RawQuestion> = {}): RawQuestion {
  return {
    index: 136,
    year: 2023,
    language: null,
    discipline: 'matematica',
    context: 'Um artista esculpe um cone reto de 36 cm de altura.',
    files: [],
    correctAlternative: 'B',
    alternativesIntroduction: 'Qual é a massa, em grama, dessa escultura?',
    alternatives: [
      { letter: 'A', text: '1.198,8', file: null, isCorrect: false },
      { letter: 'B', text: '1.296,0', file: null, isCorrect: true },
      { letter: 'C', text: '1.360,8', file: null, isCorrect: false },
    ],
    ...overrides,
  };
}

describe('mapExam', () => {
  it('rotula a prova regular pelo ano', () => {
    expect(mapExam('2023', { title: 'ENEM 2023', year: 2023 })).toEqual({
      slug: '2023',
      year: 2023,
      label: 'ENEM 2023',
      isReapplication: false,
    });
  });

  it('distingue a reaplicação, que tem o MESMO ano da regular', () => {
    const rea = mapExam('2023-reaplicacao', {
      title: 'ENEM 2023 - Reaplicação',
      year: 2023,
    });
    expect(rea.year).toBe(2023);
    expect(rea.slug).toBe('2023-reaplicacao');
    expect(rea.isReapplication).toBe(true);
    expect(rea.label).toContain('reaplicação');
  });
});

describe('rewriteImageUrl', () => {
  it('converte a URL do enem.dev no caminho servido localmente', () => {
    expect(
      rewriteImageUrl('https://enem.dev/2023/questions/136/abc-123.png'),
    ).toBe('/media/enem/2023/136/abc-123.png');
  });

  it('preserva o diretório da questão de língua estrangeira', () => {
    expect(
      rewriteImageUrl('https://enem.dev/2023/questions/1-ingles/x.png'),
    ).toBe('/media/enem/2023/1-ingles/x.png');
  });

  it('deixa URL fora do padrão intacta em vez de gerar caminho quebrado', () => {
    const outra = 'https://exemplo.org/figura.png';
    expect(rewriteImageUrl(outra)).toBe(outra);
  });

  it('reescreve todas as imagens de um Markdown', () => {
    const md =
      'Veja ![](https://enem.dev/2023/questions/136/a.png) e ' +
      '![fig](https://enem.dev/2023/questions/136/b.png).';
    const out = rewriteImageUrls(md);
    expect(out).toContain('](/media/enem/2023/136/a.png)');
    expect(out).toContain('](/media/enem/2023/136/b.png)');
    expect(out).not.toContain('enem.dev');
  });

  it('imageRelativePath extrai o caminho para copiar o arquivo', () => {
    expect(
      imageRelativePath('https://enem.dev/2023/questions/136/abc.png'),
    ).toBe('2023/136/abc.png');
    expect(imageRelativePath('https://exemplo.org/x.png')).toBeNull();
  });
});

describe('mapQuestion', () => {
  it('usa o diretório da questão no externalId, não o índice', () => {
    // É o que separa a reaplicação da prova regular: mesmo ano, mesmo índice.
    expect(mapQuestion(raw(), '2023', '136').externalId).toBe('enem:2023:136');
    expect(mapQuestion(raw(), '2023-reaplicacao', '136').externalId).toBe(
      'enem:2023-reaplicacao:136',
    );
    expect(
      mapQuestion(raw({ language: 'ingles', index: 1 }), '2023', '1-ingles')
        .externalId,
    ).toBe('enem:2023:1-ingles');
  });

  it('separa texto de apoio (statement) do comando (questionPrompt)', () => {
    const q = mapQuestion(raw(), '2023', '136');
    expect(q.statement).toContain('Um artista esculpe');
    expect(q.questionPrompt).toBe('Qual é a massa, em grama, dessa escultura?');
  });

  it('sem contexto, o comando VIRA o enunciado e não se repete', () => {
    const q = mapQuestion(
      raw({
        context: '',
        alternativesIntroduction: 'No princípio era o verbo.',
      }),
      '2023',
      '20',
    );
    expect(q.statement).toBe('No princípio era o verbo.');
    expect(q.questionPrompt).toBeNull();
  });

  it('a área vem da numeração oficial, com o nome da taxonomia', () => {
    expect(mapQuestion(raw(), '2023', '136').areaName).toBe(
      'Matemática e suas Tecnologias',
    );
    expect(
      mapQuestion(
        raw({ index: 60, discipline: 'ciencias-humanas' }),
        '2023',
        '60',
      ).areaName,
    ).toBe('Ciências Humanas e suas Tecnologias');
  });

  it('corrige o rótulo errado do dataset pela posição da questão', () => {
    // Questão 100 de 2023 é de Natureza, mesmo que o dataset diga Humanas.
    const q = mapQuestion(
      raw({ index: 100, discipline: 'ciencias-humanas' }),
      '2023',
      '100',
    );
    expect(q.areaName).toBe('Ciências da Natureza e suas Tecnologias');
    expect(q.areaCorrected).toBe(true);
    expect(mapQuestion(raw(), '2023', '136').areaCorrected).toBe(false);
  });

  it('fora da faixa oficial, usa o rótulo e rejeita disciplina desconhecida', () => {
    expect(() =>
      mapQuestion(raw({ index: 999, discipline: 'astrologia' }), '2023', '999'),
    ).toThrow(QuestionValidationError);
  });

  it('gera o código e o número da questão', () => {
    const q = mapQuestion(raw(), '2023', '136');
    expect(q.code).toBe('ENEM-2023-136');
    expect(q.number).toBe(136);
  });

  it('questão de língua estrangeira já nasce com matéria e assunto', () => {
    const q = mapQuestion(
      raw({ language: 'ingles', discipline: 'linguagens' }),
      '2023',
      '1-ingles',
    );
    expect(q.language).toBe('ingles');
    expect(q.subjectName).toBe('Língua Estrangeira');
    expect(q.topicName).toBe('Interpretação de texto em inglês');
  });

  it('questão comum entra sem matéria/assunto, só com a área', () => {
    const q = mapQuestion(raw(), '2023', '136');
    expect(q.subjectName).toBeNull();
    expect(q.topicName).toBeNull();
  });

  it('preserva letra e ordem das alternativas', () => {
    const q = mapQuestion(raw(), '2023', '136');
    expect(q.alternatives.map((a) => a.letter)).toEqual(['A', 'B', 'C']);
    expect(q.alternatives.map((a) => a.position)).toEqual([0, 1, 2]);
    expect(q.alternatives.filter((a) => a.isCorrect)).toHaveLength(1);
    expect(q.alternatives.find((a) => a.isCorrect)!.letter).toBe('B');
  });

  it('aceita alternativa que é imagem (sem texto)', () => {
    const q = mapQuestion(
      raw({
        alternatives: [
          {
            letter: 'A',
            text: null,
            file: 'https://enem.dev/2023/questions/110/a.png',
            isCorrect: false,
          },
          {
            letter: 'B',
            text: null,
            file: 'https://enem.dev/2023/questions/110/b.png',
            isCorrect: true,
          },
        ],
      }),
      '2023',
      '110',
    );
    expect(q.alternatives[0].imageUrl).toBe('/media/enem/2023/110/a.png');
    expect(q.alternatives[0].text).toBe('');
    expect(q.imageUrls).toHaveLength(2);
  });

  it('rejeita gabarito divergente entre as duas fontes do dataset', () => {
    // correctAlternative diz "B", mas quem está marcada é a "C".
    expect(() =>
      mapQuestion(
        raw({
          correctAlternative: 'B',
          alternatives: [
            { letter: 'A', text: 'a', file: null, isCorrect: false },
            { letter: 'B', text: 'b', file: null, isCorrect: false },
            { letter: 'C', text: 'c', file: null, isCorrect: true },
          ],
        }),
        '2023',
        '1',
      ),
    ).toThrow(QuestionValidationError);
  });

  it('usa correctAlternative quando nenhuma alternativa vem marcada', () => {
    // Centenas de questões do dataset chegam sem nenhum isCorrect=true. O
    // gabarito publicado pela prova é o correctAlternative — ele manda.
    const q = mapQuestion(
      raw({
        correctAlternative: 'B',
        alternatives: [
          { letter: 'A', text: 'a', file: null, isCorrect: false },
          { letter: 'B', text: 'b', file: null, isCorrect: false },
        ],
      }),
      '2023',
      '1',
    );
    expect(q.alternatives.filter((a) => a.isCorrect)).toHaveLength(1);
    expect(q.alternatives.find((a) => a.isCorrect)?.letter).toBe('B');
  });

  it('rejeita gabarito divergente entre as duas fontes do dataset', () => {
    expect(() =>
      mapQuestion(
        raw({
          correctAlternative: 'A',
          alternatives: [
            { letter: 'A', text: 'a', file: null, isCorrect: false },
            { letter: 'B', text: 'b', file: null, isCorrect: true },
          ],
        }),
        '2023',
        '1',
      ),
    ).toThrow(QuestionValidationError);
  });

  it('rejeita correctAlternative que não existe entre as letras', () => {
    expect(() =>
      mapQuestion(
        raw({
          correctAlternative: 'E',
          alternatives: [
            { letter: 'A', text: 'a', file: null, isCorrect: false },
            { letter: 'B', text: 'b', file: null, isCorrect: false },
          ],
        }),
        '2023',
        '1',
      ),
    ).toThrow(QuestionValidationError);
  });

  it('recupera alternativas de imagem que vieram no files da questão', () => {
    // Padrão real do dataset (2021 reaplicação): as cinco imagens das
    // alternativas chegam no `files` e no enunciado, com o `file` de cada
    // alternativa nulo. Elas viram alternativas e saem do enunciado.
    const base = 'https://enem.dev/2021-reaplicacao/questions/176';
    const q = mapQuestion(
      raw({
        year: 2021,
        index: 176,
        context: `Sequência de quadrinhos\n\n![](${base}/a.png)\n![](${base}/b.png)\n![](${base}/c.png)`,
        files: [`${base}/a.png`, `${base}/b.png`, `${base}/c.png`],
        correctAlternative: 'C',
        alternativesIntroduction: 'pela sequência de quadrinhos',
        alternatives: [
          { letter: 'A', text: null, file: null, isCorrect: false },
          { letter: 'B', text: null, file: null, isCorrect: false },
          { letter: 'C', text: null, file: null, isCorrect: true },
        ],
      }),
      '2021-reaplicacao',
      '176',
    );
    expect(q.alternatives.map((a) => a.imageUrl)).toEqual([
      '/media/enem/2021-reaplicacao/176/a.png',
      '/media/enem/2021-reaplicacao/176/b.png',
      '/media/enem/2021-reaplicacao/176/c.png',
    ]);
    // Promovidas a alternativa, não aparecem mais no enunciado.
    expect(q.statement).toBe('Sequência de quadrinhos');
    expect(q.alternatives.find((a) => a.isCorrect)?.letter).toBe('C');
  });

  it('não recupera quando as imagens sobrando não dão para todas as vazias', () => {
    const base = 'https://enem.dev/2020-reaplicacao/questions/10';
    expect(() =>
      mapQuestion(
        raw({
          year: 2020,
          index: 10,
          files: [`${base}/a.png`],
          correctAlternative: 'A',
          alternatives: [
            { letter: 'A', text: null, file: null, isCorrect: false },
            { letter: 'B', text: null, file: null, isCorrect: false },
          ],
        }),
        '2020-reaplicacao',
        '10',
      ),
    ).toThrow(QuestionValidationError);
  });

  it('rejeita letras repetidas', () => {
    expect(() =>
      mapQuestion(
        raw({
          correctAlternative: 'A',
          alternatives: [
            { letter: 'A', text: 'a', file: null, isCorrect: true },
            { letter: 'A', text: 'b', file: null, isCorrect: false },
          ],
        }),
        '2023',
        '1',
      ),
    ).toThrow(QuestionValidationError);
  });

  it('rejeita questão sem enunciado nenhum', () => {
    expect(() =>
      mapQuestion(
        raw({ context: '', alternativesIntroduction: '' }),
        '2023',
        '1',
      ),
    ).toThrow(QuestionValidationError);
  });

  it('reescreve as imagens do enunciado e as coleta para cópia', () => {
    const q = mapQuestion(
      raw({
        context: 'Figura: ![](https://enem.dev/2023/questions/136/fig.png)',
        files: ['https://enem.dev/2023/questions/136/fig.png'],
      }),
      '2023',
      '136',
    );
    expect(q.statement).toContain('/media/enem/2023/136/fig.png');
    expect(q.statement).not.toContain('enem.dev');
    expect(q.imageUrls).toEqual([
      'https://enem.dev/2023/questions/136/fig.png',
    ]);
  });
});

describe('numeração oficial', () => {
  it('2017 em diante: Linguagens, Humanas | Natureza, Matemática', () => {
    expect(areaBlocks(2023)).toEqual([
      'linguagens',
      'ciencias-humanas',
      'ciencias-natureza',
      'matematica',
    ]);
    expect(disciplineFromNumber(2023, 1)).toBe('linguagens');
    expect(disciplineFromNumber(2023, 46)).toBe('ciencias-humanas');
    expect(disciplineFromNumber(2023, 91)).toBe('ciencias-natureza');
    expect(disciplineFromNumber(2023, 180)).toBe('matematica');
  });

  it('2010–2016: Humanas, Natureza | Linguagens, Matemática', () => {
    expect(disciplineFromNumber(2016, 1)).toBe('ciencias-humanas');
    expect(disciplineFromNumber(2010, 91)).toBe('linguagens');
  });

  it('2009 tem Natureza antes de Humanas', () => {
    expect(disciplineFromNumber(2009, 1)).toBe('ciencias-natureza');
    expect(disciplineFromNumber(2009, 46)).toBe('ciencias-humanas');
  });

  it('número fora de 1..180 não tem área definida', () => {
    expect(disciplineFromNumber(2023, 0)).toBeNull();
    expect(disciplineFromNumber(2023, 181)).toBeNull();
  });

  it('1–90 é o primeiro dia, 91–180 o segundo', () => {
    expect(examDay(1)).toBe(1);
    expect(examDay(90)).toBe(1);
    expect(examDay(91)).toBe(2);
    expect(examDay(180)).toBe(2);
  });
});

describe('questionCode', () => {
  it('segue o formato ENEM-ANO-QUESTÃO, com três dígitos', () => {
    expect(questionCode('2023', 2023, 136, null)).toBe('ENEM-2023-136');
    expect(questionCode('2019', 2019, 7, null)).toBe('ENEM-2019-007');
  });

  it('marca a reaplicação no ano, que é o mesmo da prova regular', () => {
    expect(questionCode('2023-reaplicacao', 2023, 136, null)).toBe(
      'ENEM-2023R-136',
    );
  });

  it('distingue as versões em inglês e espanhol da mesma questão', () => {
    expect(questionCode('2023', 2023, 1, 'ingles')).toBe('ENEM-2023-001-ING');
    expect(questionCode('2023', 2023, 1, 'espanhol')).toBe('ENEM-2023-001-ESP');
  });
});

describe('normalizeCodeQuery', () => {
  it.each([
    ['2023 136', 'ENEM-2023-136'],
    ['enem 2023 7', 'ENEM-2023-007'],
    ['ENEM-2023-136', 'ENEM-2023-136'],
    ['2023r', 'ENEM-2023R'],
    ['2023', 'ENEM-2023'],
    ['enem_2023_1_ing', 'ENEM-2023-001-ING'],
    ['  2023/45  ', 'ENEM-2023-045'],
  ])('%j vira %j', (entrada, esperado) => {
    expect(normalizeCodeQuery(entrada)).toBe(esperado);
  });
});

describe('dias da prova', () => {
  it('duração oficial por era', () => {
    expect(officialDurationMin(2015, 1)).toBe(270);
    expect(officialDurationMin(2015, 2)).toBe(330);
    expect(officialDurationMin(2017, 1)).toBe(330);
    expect(officialDurationMin(2017, 2)).toBe(270);
    expect(officialDurationMin(2023, 2)).toBe(300);
  });

  it('áreas de cada dia seguem a ordem da época', () => {
    expect(dayAreas(2023, 2)).toEqual([
      'Ciências da Natureza e suas Tecnologias',
      'Matemática e suas Tecnologias',
    ]);
    expect(dayAreas(2015, 1)).toEqual([
      'Ciências Humanas e suas Tecnologias',
      'Ciências da Natureza e suas Tecnologias',
    ]);
  });
});
