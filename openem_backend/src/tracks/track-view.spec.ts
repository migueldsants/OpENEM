import type { TopicAnswers } from '../common/mastery';
import {
  buildTrackView,
  overallMastery,
  resolveTracks,
  suggestStages,
  type ResolvedTrack,
} from './track-view';
import type { TrackDef } from './tracks-catalog';

const subject = (
  id: string,
  name: string,
  topics: string[],
  area = 'Matemática e suas Tecnologias',
) => ({
  id,
  name,
  subjectArea: { id: `a-${id}`, name: area },
  topics: topics.map((t) => ({ id: `${id}:${t}`, name: t })),
});

const inc = (perExam: number, primaryPerExam = perExam) => ({
  perExam,
  primaryPerExam,
  years: perExam > 0 ? 10 : 0,
  byYear: [],
});

const respostas = (...seq: boolean[]): TopicAnswers => ({
  total: seq.length,
  correct: seq.filter(Boolean).length,
  recent: seq.slice(0, 10),
});

const MAT: TrackDef = {
  subject: 'Matemática',
  stages: [
    { title: 'Base', why: 'x', topics: ['Operações', 'Fantasma'] },
    { title: 'Proporção', why: 'y', topics: ['Razão', 'Porcentagem'] },
  ],
  extras: ['Polinômios'],
};

function resolveMat(bank: Record<string, number> = {}) {
  const [track] = resolveTracks(
    [MAT],
    [
      subject('m', 'Matemática', [
        'Operações',
        'Razão',
        'Porcentagem',
        'Polinômios',
        'Novo',
      ]),
    ],
    {
      topics: {
        'm:Operações': inc(2),
        'm:Razão': inc(5),
        'm:Porcentagem': inc(3),
        'm:Polinômios': inc(0.1),
      },
      bank: {
        'm:Operações': 10,
        'm:Razão': 10,
        'm:Porcentagem': 10,
        'm:Polinômios': 1,
        ...bank,
      },
    },
  );
  return track;
}

describe('resolveTracks', () => {
  it('resolve nomes em ids, ignora nome inexistente e manda assunto não citado para extras', () => {
    const t = resolveMat();
    expect(t.stages[0].topicIds).toEqual(['m:Operações']);
    expect(t.extras).toEqual(['m:Polinômios', 'm:Novo']);
    expect(t.topics['m:Novo']).toMatchObject({ perExam: 0, bank: 0 });
  });

  it('pula matéria que não existe no banco', () => {
    expect(resolveTracks([MAT], [], { topics: {}, bank: {} })).toEqual([]);
  });
});

describe('buildTrackView', () => {
  it('aluno novo: nada visto, etapa atual é a primeira', () => {
    const v = buildTrackView(resolveMat(), new Map(), 'ingles');
    expect(v.currentStage).toBe(0);
    expect(v.mastery).toBe(0);
    expect(v.perExam).toBe(10.1);
    expect(v.stages[1].perExam).toBe(8);
    expect(v.stages.every((s) => !s.done)).toBe(true);
  });

  it('etapa concluída quando todo assunto treinável está dominado', () => {
    const dominado = respostas(true, true, true, true, true);
    const v = buildTrackView(
      resolveMat(),
      new Map([['m:Operações', dominado]]),
      'ingles',
    );
    expect(v.stages[0].done).toBe(true);
    expect(v.currentStage).toBe(1);
    expect(v.stages[0].topics[0]).toMatchObject({
      state: 'dominado',
      mastery: 100,
      answered: 5,
      accuracy: 100,
    });
  });

  it('assunto sem questão no banco não trava a etapa', () => {
    const track = resolveMat({ 'm:Porcentagem': 0 });
    const v = buildTrackView(
      track,
      new Map([
        ['m:Operações', respostas(true, true, true, true, true)],
        ['m:Razão', respostas(true, true, true, true, true)],
      ]),
      'ingles',
    );
    expect(v.stages[1].done).toBe(true);
    expect(v.currentStage).toBeNull();
  });

  it('o domínio da matéria pondera pelo quanto cada assunto cai', () => {
    const v = buildTrackView(
      resolveMat(),
      new Map([['m:Razão', respostas(true, true, true, true, true)]]),
      'ingles',
    );
    // Razão vale 5 de 10,1 questões por prova.
    expect(v.mastery).toBeCloseTo(5 / 10.1, 5);
  });

  it('mostra só o assunto da língua do aluno e soma a parte dele', () => {
    const def: TrackDef = {
      subject: 'Língua Estrangeira',
      stages: [
        {
          title: 'Leitura',
          why: 'z',
          topics: [
            'Interpretação de texto em inglês',
            'Interpretação de texto em espanhol',
          ],
        },
      ],
      extras: [],
    };
    const [track] = resolveTracks(
      [def],
      [
        subject('le', 'Língua Estrangeira', [
          'Interpretação de texto em inglês',
          'Interpretação de texto em espanhol',
        ]),
      ],
      {
        topics: {
          'le:Interpretação de texto em inglês': inc(4.8, 4.8),
          // Espanhol não soma na matéria pela conta geral, mas é o que o
          // aluno de espanhol encontra na prova.
          'le:Interpretação de texto em espanhol': inc(4.9, 0),
        },
        bank: {},
      },
    );
    const esp = buildTrackView(track, new Map(), 'espanhol');
    expect(esp.stages[0].topics.map((t) => t.name)).toEqual([
      'Interpretação de texto em espanhol',
    ]);
    expect(esp.perExam).toBe(4.9);
    const ing = buildTrackView(track, new Map(), 'ingles');
    expect(ing.perExam).toBe(4.8);
  });
});

describe('suggestStages e overallMastery', () => {
  const pequena: ResolvedTrack = {
    ...resolveMat(),
    subjectId: 'p',
    subjectName: 'Pequena',
    topics: Object.fromEntries(
      Object.entries(resolveMat().topics).map(([k, t]) => [
        k,
        {
          ...t,
          perExam: t.perExam / 10,
          primaryPerExam: t.primaryPerExam / 10,
        },
      ]),
    ),
  };

  it('sugere a etapa atual de quem mais rende agora', () => {
    const views = [
      buildTrackView(pequena, new Map(), 'ingles'),
      buildTrackView(resolveMat(), new Map(), 'ingles'),
    ];
    const [primeira, segunda] = suggestStages(views, 2);
    expect(primeira).toMatchObject({
      subjectName: 'Matemática',
      stageIndex: 0,
      title: 'Base',
    });
    expect(segunda.subjectName).toBe('Pequena');
  });

  it('matéria sem etapa pendente não é sugerida', () => {
    const tudo = respostas(true, true, true, true, true);
    const v = buildTrackView(
      resolveMat(),
      new Map([
        ['m:Operações', tudo],
        ['m:Razão', tudo],
        ['m:Porcentagem', tudo],
      ]),
      'ingles',
    );
    expect(suggestStages([v])).toEqual([]);
  });

  it('a porcentagem geral só vale a partir de 30 respostas', () => {
    const poucas = buildTrackView(
      resolveMat(),
      new Map([['m:Razão', respostas(true, true, true)]]),
      'ingles',
    );
    expect(overallMastery([poucas])).toMatchObject({
      answered: 3,
      enough: false,
    });
    const muitas = buildTrackView(
      resolveMat(),
      new Map([['m:Razão', respostas(...Array(30).fill(true))]]),
      'ingles',
    );
    expect(overallMastery([muitas])).toMatchObject({
      mastery: 50,
      answered: 30,
      enough: true,
    });
  });
});
