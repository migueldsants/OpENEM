import {
  ACHIEVEMENTS,
  evaluateAchievements,
  pointsForAnswer,
  POINTS,
  updateStreak,
} from './gamification';

const day = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe('updateStreak', () => {
  it('inicia a sequência na primeira atividade', () => {
    const r = updateStreak(
      { currentStreak: 0, longestStreak: 0, lastActivityOn: null },
      day('2026-06-18'),
    );
    expect(r.currentStreak).toBe(1);
    expect(r.longestStreak).toBe(1);
    expect(r.incremented).toBe(true);
  });

  it('não altera no mesmo dia', () => {
    const r = updateStreak(
      { currentStreak: 3, longestStreak: 5, lastActivityOn: day('2026-06-18') },
      day('2026-06-18'),
    );
    expect(r.currentStreak).toBe(3);
    expect(r.incremented).toBe(false);
  });

  it('incrementa em dia consecutivo', () => {
    const r = updateStreak(
      { currentStreak: 3, longestStreak: 3, lastActivityOn: day('2026-06-18') },
      day('2026-06-19'),
    );
    expect(r.currentStreak).toBe(4);
    expect(r.longestStreak).toBe(4);
    expect(r.incremented).toBe(true);
  });

  it('reinicia após lacuna mas preserva o recorde', () => {
    const r = updateStreak(
      { currentStreak: 6, longestStreak: 6, lastActivityOn: day('2026-06-18') },
      day('2026-06-21'),
    );
    expect(r.currentStreak).toBe(1);
    expect(r.longestStreak).toBe(6);
    expect(r.incremented).toBe(true);
  });
});

describe('pointsForAnswer', () => {
  it('dá mais pontos por acerto', () => {
    expect(pointsForAnswer(true)).toBe(POINTS.correctAnswer);
    expect(pointsForAnswer(false)).toBe(POINTS.wrongAnswer);
    expect(pointsForAnswer(true)).toBeGreaterThan(pointsForAnswer(false));
  });
});

describe('evaluateAchievements', () => {
  it('desbloqueia conquistas atingidas e ignora as já obtidas', () => {
    const earned = evaluateAchievements(
      { points: 0, currentStreak: 1, answersCount: 1, correctCount: 0 },
      [],
    );
    expect(earned).toContain('FIRST_ANSWER');

    const again = evaluateAchievements(
      { points: 0, currentStreak: 1, answersCount: 1, correctCount: 0 },
      ['FIRST_ANSWER'],
    );
    expect(again).not.toContain('FIRST_ANSWER');
  });

  it('respeita os limiares de streak e pontos', () => {
    const earned = evaluateAchievements(
      { points: 600, currentStreak: 7, answersCount: 10, correctCount: 10 },
      [],
    );
    expect(earned).toEqual(
      expect.arrayContaining([
        'STREAK_3',
        'STREAK_7',
        'POINTS_500',
        'TEN_ANSWERS',
        'TEN_CORRECT',
      ]),
    );
    expect(earned).not.toContain('STREAK_30');
    expect(earned).not.toContain('POINTS_2000');
  });

  it('todo código de regra existe no catálogo', () => {
    const all = evaluateAchievements(
      {
        points: 999999,
        currentStreak: 999,
        answersCount: 999,
        correctCount: 999,
      },
      [],
    );
    expect(all.sort()).toEqual(ACHIEVEMENTS.map((a) => a.code).sort());
  });
});
