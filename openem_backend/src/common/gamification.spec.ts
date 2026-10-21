import {
  ACHIEVEMENTS,
  achievementProgress,
  comboMultiplierForStreak,
  dailyBonusXp,
  evaluateAchievements,
  type GamificationSnapshot,
  leagueForLevel,
  levelFromXp,
  pointsForAnswer,
  POINTS,
  updateStreak,
  visibleAchievements,
  xpForAnswer,
  xpForEssay,
  xpForSimulation,
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

  it('conta o dia de Brasília: a questão das 22h fica no mesmo dia', () => {
    // 10h e 22h de 18/06 em Brasília; em UTC a segunda já é 19/06.
    const manha = updateStreak(
      { currentStreak: 0, longestStreak: 0, lastActivityOn: null },
      new Date('2026-06-18T13:00:00Z'),
    );
    expect(manha.lastActivityOn?.toISOString()).toBe(
      '2026-06-18T00:00:00.000Z',
    );
    const noite = updateStreak(manha, new Date('2026-06-19T01:00:00Z'));
    expect(noite.incremented).toBe(false);
    expect(noite.currentStreak).toBe(1);
  });

  it('o dia seguinte começa à meia-noite de Brasília (03h UTC)', () => {
    const state = {
      currentStreak: 2,
      longestStreak: 2,
      lastActivityOn: new Date('2026-06-18T00:00:00Z'),
    };
    expect(
      updateStreak(state, new Date('2026-06-19T02:59:00Z')).incremented,
    ).toBe(false);
    const r = updateStreak(state, new Date('2026-06-19T03:00:00Z'));
    expect(r.currentStreak).toBe(3);
    expect(r.lastActivityOn?.toISOString()).toBe('2026-06-19T00:00:00.000Z');
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

describe('xpForSimulation', () => {
  it('base + por acerto, sem bônus de velocidade além de 60% do limite', () => {
    expect(xpForSimulation(0, null)).toBe(POINTS.simulationBase);
    expect(xpForSimulation(5, 0.9)).toBe(
      POINTS.simulationBase + 5 * POINTS.simulationPerCorrect,
    );
  });

  it('bônus de velocidade quando < 60% do limite', () => {
    expect(xpForSimulation(5, 0.5)).toBe(
      POINTS.simulationBase +
        5 * POINTS.simulationPerCorrect +
        POINTS.simulationSpeedBonus,
    );
    expect(xpForSimulation(0, 0.59)).toBe(
      POINTS.simulationBase + POINTS.simulationSpeedBonus,
    );
  });

  it('exatamente 60% do limite já não ganha bônus', () => {
    expect(xpForSimulation(0, 0.6)).toBe(POINTS.simulationBase);
  });
});

describe('xpForEssay', () => {
  it('envio sem nota dá só XP base', () => {
    expect(xpForEssay(null)).toBe(POINTS.essaySubmit);
  });
  it('nota >= 800 dá bônus alto, nota >= 600 dá bônus médio', () => {
    expect(xpForEssay(800)).toBe(POINTS.essaySubmit + POINTS.essayHighScore);
    expect(xpForEssay(600)).toBe(POINTS.essaySubmit + POINTS.essayGoodScore);
    expect(xpForEssay(599)).toBe(POINTS.essaySubmit);
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
      {
        points: 0,
        currentStreak: 1,
        answersCount: 1,
        correctCount: 0,
        simulationsCount: 0,
        essaysCount: 0,
        highScoreEssays: 0,
        reviewsCount: 0,
        sessionsDone: 0,
      },
      [],
    );
    expect(earned).toContain('FIRST_ANSWER');

    const again = evaluateAchievements(
      {
        points: 0,
        currentStreak: 1,
        answersCount: 1,
        correctCount: 0,
        simulationsCount: 0,
        essaysCount: 0,
        highScoreEssays: 0,
        reviewsCount: 0,
        sessionsDone: 0,
      },
      ['FIRST_ANSWER'],
    );
    expect(again).not.toContain('FIRST_ANSWER');
  });

  it('respeita os limiares de streak e pontos', () => {
    const earned = evaluateAchievements(
      {
        points: 600,
        currentStreak: 7,
        answersCount: 10,
        correctCount: 10,
        simulationsCount: 0,
        essaysCount: 0,
        highScoreEssays: 0,
        reviewsCount: 0,
        sessionsDone: 0,
      },
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

  it('desbloqueia conquistas de simulado, revisão e sessão', () => {
    const earned = evaluateAchievements(
      {
        points: 0,
        currentStreak: 1,
        answersCount: 0,
        correctCount: 0,
        simulationsCount: 5,
        essaysCount: 1,
        highScoreEssays: 1,
        reviewsCount: 10,
        sessionsDone: 10,
      },
      [],
    );
    expect(earned).toEqual(
      expect.arrayContaining([
        'FIRST_SIMULATION',
        'FIVE_SIMULATIONS',
        'FIRST_REVIEW',
        'TEN_REVIEWS',
        'FIRST_SESSION',
        'TEN_SESSIONS',
      ]),
    );
  });

  it('conquistas aposentadas (redação) não são mais concedidas', () => {
    const earned = evaluateAchievements(
      {
        points: 0,
        currentStreak: 1,
        answersCount: 0,
        correctCount: 0,
        simulationsCount: 0,
        essaysCount: 3,
        highScoreEssays: 3,
        reviewsCount: 0,
        sessionsDone: 0,
      },
      [],
    );
    expect(earned).not.toContain('FIRST_ESSAY');
    expect(earned).not.toContain('HIGH_SCORE_ESSAY');
  });

  it('todo código de regra ativo existe no catálogo', () => {
    const all = evaluateAchievements(
      {
        points: 999999,
        currentStreak: 999,
        answersCount: 999,
        correctCount: 999,
        simulationsCount: 999,
        essaysCount: 999,
        highScoreEssays: 999,
        reviewsCount: 999,
        sessionsDone: 999,
      },
      [],
    );
    expect(all.sort()).toEqual(
      ACHIEVEMENTS.filter((a) => !a.retired)
        .map((a) => a.code)
        .sort(),
    );
  });
});

describe('visibleAchievements', () => {
  it('as de redação saem do catálogo e do total de quem não as tem', () => {
    const codes = visibleAchievements([]).map((a) => a.code);
    expect(codes).not.toContain('FIRST_ESSAY');
    expect(codes).not.toContain('HIGH_SCORE_ESSAY');
    expect(codes).toContain('FIRST_ANSWER');
    expect(codes).toHaveLength(ACHIEVEMENTS.length - 2);
  });

  it('quem já desbloqueou continua vendo, na ordem do catálogo', () => {
    const codes = visibleAchievements(['FIRST_ESSAY', 'FIRST_ANSWER']).map(
      (a) => a.code,
    );
    expect(codes).toContain('FIRST_ESSAY');
    expect(codes).not.toContain('HIGH_SCORE_ESSAY');
    expect(codes).toHaveLength(ACHIEVEMENTS.length - 1);
    expect(codes.indexOf('FIRST_ESSAY')).toBeGreaterThan(
      codes.indexOf('FIVE_SIMULATIONS'),
    );
  });
});

describe('catálogo de conquistas (issue #48)', () => {
  it('todas têm xp positivo, ícone e cor', () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.xp).toBeGreaterThan(0);
      expect(a.icon.length).toBeGreaterThan(0);
      expect(a.color).toMatch(/^text-/);
    }
  });

  it('conquistas mais difíceis valem mais XP', () => {
    const byCode = new Map(ACHIEVEMENTS.map((a) => [a.code, a]));
    expect(byCode.get('STREAK_30')!.xp).toBeGreaterThan(
      byCode.get('STREAK_3')!.xp,
    );
    expect(byCode.get('REACH_LEVEL_20')!.xp).toBeGreaterThan(
      byCode.get('REACH_LEVEL_5')!.xp,
    );
    expect(byCode.get('HUNDRED_ANSWERS')!.xp).toBeGreaterThan(
      byCode.get('TEN_ANSWERS')!.xp,
    );
  });
});

describe('achievementProgress (issue #48)', () => {
  const SNAP = (
    over: Partial<GamificationSnapshot> = {},
  ): GamificationSnapshot => ({
    points: 0,
    currentStreak: 0,
    answersCount: 0,
    correctCount: 0,
    simulationsCount: 0,
    essaysCount: 0,
    highScoreEssays: 0,
    reviewsCount: 0,
    sessionsDone: 0,
    ...over,
  });

  it('contadores: fração atual/alvo', () => {
    expect(achievementProgress('TEN_ANSWERS', SNAP({ answersCount: 4 }))).toBe(
      0.4,
    );
    expect(
      achievementProgress('HUNDRED_ANSWERS', SNAP({ answersCount: 50 })),
    ).toBe(0.5);
    expect(
      achievementProgress('TEN_SESSIONS', SNAP({ sessionsDone: 10 })),
    ).toBe(1);
  });

  it('binárias: 0 ou 1, sem meio termo', () => {
    expect(achievementProgress('FIRST_ANSWER', SNAP())).toBe(0);
    expect(achievementProgress('FIRST_ANSWER', SNAP({ answersCount: 1 }))).toBe(
      1,
    );
    expect(achievementProgress('HIGH_SCORE_ESSAY', SNAP())).toBe(0);
    expect(
      achievementProgress('HIGH_SCORE_ESSAY', SNAP({ highScoreEssays: 1 })),
    ).toBe(1);
  });

  it('XP: progresso linear até o alvo (com teto)', () => {
    expect(achievementProgress('POINTS_500', SNAP({ points: 250 }))).toBe(0.5);
    expect(achievementProgress('POINTS_2000', SNAP({ points: 9999 }))).toBe(1);
  });

  it('níveis: fração do nível atual sobre o alvo', () => {
    // Nível 3 de 5: (3-1)/(5-1) = 0.5 — 400 XP = nível 5, 225 XP = nível 4.
    expect(achievementProgress('REACH_LEVEL_5', SNAP({ points: 225 }))).toBe(
      0.75,
    );
    expect(achievementProgress('REACH_LEVEL_20', SNAP({ points: 0 }))).toBe(0);
    expect(
      achievementProgress('REACH_LEVEL_10', SNAP({ points: 999999 })),
    ).toBe(1);
  });
});
