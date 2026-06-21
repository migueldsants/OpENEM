import {
  ACHIEVEMENTS,
  comboMultiplierForStreak,
  dailyBonusXp,
  evaluateAchievements,
  leagueForLevel,
  levelFromXp,
  pointsForAnswer,
  POINTS,
  updateStreak,
  xpForAnswer,
  xpToReachLevel,
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

describe('combo e XP por resposta', () => {
  it('o multiplicador cresce com a streak e satura em 1.6×', () => {
    expect(comboMultiplierForStreak(1)).toBe(1);
    expect(comboMultiplierForStreak(2)).toBe(1.1);
    expect(comboMultiplierForStreak(7)).toBe(1.6);
    expect(comboMultiplierForStreak(50)).toBe(1.6);
  });

  it('xpForAnswer aplica o combo sobre o XP base', () => {
    expect(xpForAnswer(true, 1)).toBe(10);
    expect(xpForAnswer(true, 7)).toBe(16); // 10 × 1.6
    expect(xpForAnswer(false, 7)).toBe(3); // round(2 × 1.6)
  });
});

describe('dailyBonusXp', () => {
  it('começa em 15 e escala com a streak até 60', () => {
    expect(dailyBonusXp(1)).toBe(15);
    expect(dailyBonusXp(2)).toBe(20);
    expect(dailyBonusXp(10)).toBe(60);
    expect(dailyBonusXp(99)).toBe(60);
  });
});

describe('níveis (curva quadrática)', () => {
  it('xpToReachLevel segue 25·(L-1)²', () => {
    expect(xpToReachLevel(1)).toBe(0);
    expect(xpToReachLevel(2)).toBe(25);
    expect(xpToReachLevel(3)).toBe(100);
    expect(xpToReachLevel(5)).toBe(400);
  });

  it('levelFromXp deriva nível e progresso', () => {
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(24).level).toBe(1);
    expect(levelFromXp(25).level).toBe(2);
    expect(levelFromXp(99).level).toBe(2);
    expect(levelFromXp(100).level).toBe(3);

    const mid = levelFromXp(62); // nível 2: base 25, próximo 100 → 37/75
    expect(mid.level).toBe(2);
    expect(mid.xpIntoLevel).toBe(37);
    expect(mid.xpForNextLevel).toBe(75);
    expect(mid.progress).toBeCloseTo(37 / 75, 4);
  });
});

describe('leagueForLevel', () => {
  it('mapeia faixas de nível para ligas', () => {
    expect(leagueForLevel(1).key).toBe('BRONZE');
    expect(leagueForLevel(4).key).toBe('BRONZE');
    expect(leagueForLevel(5).key).toBe('PRATA');
    expect(leagueForLevel(10).key).toBe('OURO');
    expect(leagueForLevel(20).key).toBe('PLATINA');
    expect(leagueForLevel(35).key).toBe('DIAMANTE');
    expect(leagueForLevel(999).key).toBe('DIAMANTE');
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
