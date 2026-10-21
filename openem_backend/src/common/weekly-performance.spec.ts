import {
  addDays,
  areaKeyFromName,
  buildWeeklySummary,
  currentStreak,
  studyDay,
  weekStart,
  type WeeklyAnswer,
} from './weekly-performance';

// Quarta-feira, 21/10/2026, 15h em Brasília (18h UTC).
const AGORA = new Date('2026-10-21T18:00:00Z');

function resposta(
  iso: string,
  isCorrect: boolean,
  areaName: string | null = 'Matemática e suas Tecnologias',
  topic: WeeklyAnswer['topic'] = null,
): WeeklyAnswer {
  return { createdAt: new Date(iso), isCorrect, areaName, topic };
}

const PORCENTAGEM = {
  id: 't1',
  name: 'Porcentagem',
  weight: 5,
  subjectName: 'Matemática',
};
const CINEMATICA = {
  id: 't2',
  name: 'Cinemática',
  weight: 3,
  subjectName: 'Física',
};
const GENETICA = {
  id: 't3',
  name: 'Genética',
  weight: 3,
  subjectName: 'Biologia',
};

describe('dia e semana no fuso de Brasília', () => {
  it('às 22h de Brasília ainda é o mesmo dia (em UTC já seria o seguinte)', () => {
    expect(studyDay(new Date('2026-10-21T01:30:00Z'))).toBe('2026-10-20');
    expect(studyDay(new Date('2026-10-21T03:00:00Z'))).toBe('2026-10-21');
  });

  it('a semana começa na segunda-feira', () => {
    expect(weekStart('2026-10-21')).toBe('2026-10-19'); // quarta
    expect(weekStart('2026-10-19')).toBe('2026-10-19'); // segunda
    expect(weekStart('2026-10-25')).toBe('2026-10-19'); // domingo
  });

  it('soma dias atravessando mês e ano', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
  });
});

describe('área pelo nome', () => {
  it.each([
    ['Matemática e suas Tecnologias', 'mat'],
    ['Ciências da Natureza e suas Tecnologias', 'nat'],
    ['Física', 'nat'],
    ['Ciências Humanas e suas Tecnologias', 'hum'],
    ['História', 'hum'],
    ['Linguagens, Códigos e suas Tecnologias', 'lin'],
    ['Língua Portuguesa', 'lin'],
    ['Redação', 'lin'],
  ])('%s → %s', (nome, chave) => {
    expect(areaKeyFromName(nome)).toBe(chave);
  });

  it('nome vazio ou desconhecido não tem área', () => {
    expect(areaKeyFromName(null)).toBeNull();
    expect(areaKeyFromName('Outra coisa')).toBeNull();
  });
});

describe('sequência de dias', () => {
  const dias = (...d: string[]) => new Set(d);

  it('conta até hoje quando hoje já teve estudo', () => {
    expect(
      currentStreak(
        dias('2026-10-19', '2026-10-20', '2026-10-21'),
        '2026-10-21',
      ),
    ).toBe(3);
  });

  it('hoje em branco não zera: conta até ontem', () => {
    expect(currentStreak(dias('2026-10-19', '2026-10-20'), '2026-10-21')).toBe(
      2,
    );
  });

  it('um dia sem estudo antes de ontem zera', () => {
    expect(currentStreak(dias('2026-10-18'), '2026-10-21')).toBe(0);
  });
});

describe('resumo semanal', () => {
  it('monta a semana atual primeiro, de segunda a domingo, com a variação', () => {
    const r = buildWeeklySummary(
      [
        // Semana passada (12 a 18/10): 1 de 2.
        resposta('2026-10-14T15:00:00Z', true),
        resposta('2026-10-14T15:05:00Z', false),
        // Esta semana: 3 de 4, uma delas às 22h30 de terça (01h30 UTC de quarta).
        resposta(
          '2026-10-21T01:30:00Z',
          true,
          'Ciências da Natureza e suas Tecnologias',
        ),
        resposta('2026-10-21T12:00:00Z', true),
        resposta('2026-10-21T12:05:00Z', true),
        resposta('2026-10-21T12:10:00Z', false),
      ],
      [{ completedAt: new Date('2026-10-21T13:00:00Z'), durationSec: 25 * 60 }],
      AGORA,
      3,
    );

    expect(r.today).toBe('2026-10-21');
    expect(r.weeks.map((w) => w.start)).toEqual([
      '2026-10-19',
      '2026-10-12',
      '2026-10-05',
    ]);
    const atual = r.weeks[0];
    expect(atual.days).toHaveLength(7);
    expect(atual.end).toBe('2026-10-25');
    expect(atual.answers).toBe(4);
    expect(atual.accuracy).toBe(75);
    expect(atual.minutes).toBe(25);
    expect(atual.days.find((d) => d.date === '2026-10-20')).toMatchObject({
      answers: 1,
      studied: true,
    });
    expect(atual.daysStudied).toBe(2);
    expect(atual.areas.find((a) => a.area === 'nat')).toMatchObject({
      answers: 1,
      accuracy: 100,
    });
    expect(atual.areas.find((a) => a.area === 'hum')).toMatchObject({
      answers: 0,
      accuracy: null,
    });
    expect(atual.delta).toBe(25); // 75% contra 50%
    expect(r.weeks[1].delta).toBeNull(); // a semana de 05/10 não teve resposta
    expect(r.streak).toBe(2);
  });

  it('sessão de foco também conta como dia estudado', () => {
    const r = buildWeeklySummary(
      [],
      [{ completedAt: new Date('2026-10-21T12:00:00Z'), durationSec: 50 * 60 }],
      AGORA,
      1,
    );
    expect(r.weeks[0].minutes).toBe(50);
    expect(r.weeks[0].daysStudied).toBe(1);
    expect(r.weeks[0].accuracy).toBeNull();
    expect(r.streak).toBe(1);
  });

  it('prioridades: erro com volume e peso na prova, sem assunto de 1 resposta nem tudo certo', () => {
    const r = buildWeeklySummary(
      [
        // Porcentagem (peso 5): 1 de 4.
        ...[true, false, false, false].map((c, i) =>
          resposta(
            `2026-10-20T12:0${i}:00Z`,
            c,
            'Matemática e suas Tecnologias',
            PORCENTAGEM,
          ),
        ),
        // Cinemática (peso 3): 1 de 4.
        ...[true, false, false, false].map((c, i) =>
          resposta(
            `2026-10-20T13:0${i}:00Z`,
            c,
            'Ciências da Natureza e suas Tecnologias',
            CINEMATICA,
          ),
        ),
        // Genética: só acertos, não é prioridade.
        resposta('2026-10-20T14:00:00Z', true, null, GENETICA),
        resposta('2026-10-20T14:01:00Z', true, null, GENETICA),
        // Sem assunto, dentro da janela.
        resposta('2026-10-20T15:00:00Z', false),
        // Fora da janela de 30 dias.
        resposta('2026-09-01T15:00:00Z', false, null, GENETICA),
      ],
      [],
      AGORA,
      1,
    );
    expect(r.priorities.map((p) => p.topic)).toEqual([
      'Porcentagem',
      'Cinemática',
    ]);
    expect(r.priorities[0]).toMatchObject({
      area: 'mat',
      accuracy: 25,
      answers: 4,
      weight: 5,
    });
    expect(r.priorities[1].area).toBe('nat');
    expect(r.unclassified).toBe(1);
  });

  it('sem nada estudado: semanas vazias, sem prioridade e sequência zero', () => {
    const r = buildWeeklySummary([], [], AGORA, 4);
    expect(r.weeks).toHaveLength(4);
    expect(r.weeks.every((w) => w.answers === 0 && w.accuracy === null)).toBe(
      true,
    );
    expect(r.priorities).toEqual([]);
    expect(r.streak).toBe(0);
  });
});
