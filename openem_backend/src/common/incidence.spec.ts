import {
  computeIncidence,
  describeWindow,
  INCIDENCE_WINDOW,
  pickWindow,
} from './incidence';

const exam = (year: number, id = `e${year}`) => ({ id, year });

describe('pickWindow', () => {
  it('fica com as 10 provas mais recentes, em ordem crescente', () => {
    const exams = Array.from({ length: 14 }, (_, i) => exam(2012 + i));
    const window = pickWindow(exams);
    expect(window).toHaveLength(INCIDENCE_WINDOW);
    expect(window[0].year).toBe(2016);
    expect(window.at(-1)!.year).toBe(2025);
  });

  it('não depende da ordem de entrada', () => {
    const a = pickWindow([exam(2020), exam(2018), exam(2019)], 2);
    expect(a.map((e) => e.year)).toEqual([2019, 2020]);
  });

  it('banco sem provas dá janela vazia e sem descrição', () => {
    expect(pickWindow([])).toEqual([]);
    expect(describeWindow([])).toBeNull();
  });

  it('descreve o recorte para a tela', () => {
    expect(describeWindow([exam(2023), exam(2024), exam(2025)])).toEqual({
      fromYear: 2023,
      toYear: 2025,
      exams: 3,
      years: [2023, 2024, 2025],
    });
  });
});

describe('computeIncidence', () => {
  const window = [exam(2023), exam(2024)];

  it('calcula a média por prova, os anos em que caiu e a série por ano', () => {
    const inc = computeIncidence(window, [
      { topicId: 't', examYearId: 'e2023', language: null, n: 3 },
      { topicId: 't', examYearId: 'e2024', language: null, n: 1 },
      { topicId: 'u', examYearId: 'e2024', language: null, n: 1 },
    ]);
    expect(inc.t).toEqual({
      perExam: 2,
      primaryPerExam: 2,
      years: 2,
      byYear: [3, 1],
    });
    // Ano sem o assunto conta zero na média e na série.
    expect(inc.u).toEqual({
      perExam: 0.5,
      primaryPerExam: 0.5,
      years: 1,
      byYear: [0, 1],
    });
  });

  it('a segunda língua conta no próprio assunto mas fica fora da soma da matéria', () => {
    const inc = computeIncidence(window, [
      { topicId: 'esp', examYearId: 'e2023', language: 'espanhol', n: 5 },
      { topicId: 'esp', examYearId: 'e2024', language: 'espanhol', n: 5 },
      { topicId: 'ing', examYearId: 'e2023', language: 'ingles', n: 5 },
    ]);
    expect(inc.esp.perExam).toBe(5);
    expect(inc.esp.primaryPerExam).toBe(0);
    expect(inc.ing.primaryPerExam).toBe(2.5);
  });

  it('ignora provas fora da janela e contagens vazias', () => {
    const inc = computeIncidence(window, [
      { topicId: 't', examYearId: 'e2010', language: null, n: 9 },
      { topicId: 'z', examYearId: 'e2023', language: null, n: 0 },
    ]);
    expect(inc).toEqual({});
  });

  it('arredonda em duas casas', () => {
    const tres = [exam(2023), exam(2024), exam(2025)];
    const inc = computeIncidence(tres, [
      { topicId: 't', examYearId: 'e2023', language: null, n: 1 },
    ]);
    expect(inc.t.perExam).toBe(0.33);
  });
});
