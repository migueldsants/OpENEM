import {
  dailyChallengeFor,
  dailyChallengeStatus,
  dayKey,
} from './daily-challenge';

describe('daily-challenge', () => {
  it('dayKey usa o dia de calendário de Brasília', () => {
    // 20h30 de 21/06 em Brasília: em UTC já seria 22/06.
    expect(dayKey(new Date('2026-06-21T23:30:00Z'))).toBe('2026-06-21');
    expect(dayKey(new Date('2026-06-22T02:59:00Z'))).toBe('2026-06-21');
    expect(dayKey(new Date('2026-06-22T03:00:00Z'))).toBe('2026-06-22');
  });

  it('é determinístico para o mesmo dia', () => {
    const a = dailyChallengeFor(new Date('2026-06-21T08:00:00Z'));
    const b = dailyChallengeFor(new Date('2026-06-21T20:00:00Z'));
    expect(a).toEqual(b);
  });

  it('o desafio não renova às 21h de Brasília', () => {
    const tarde = dailyChallengeFor(new Date('2026-06-21T20:00:00Z'));
    const noite = dailyChallengeFor(new Date('2026-06-22T01:30:00Z'));
    expect(noite).toEqual(tarde);
  });

  it('gera metas válidas e recompensa proporcional', () => {
    const spec = dailyChallengeFor(new Date('2026-06-21T00:00:00Z'));
    expect([5, 8, 10]).toContain(spec.goal);
    expect(spec.xpReward).toBe(20 + spec.goal * 5);
  });

  it('status reflete progresso, conclusão e resgate', () => {
    const spec = { day: '2026-06-21', goal: 5, xpReward: 45 };
    expect(dailyChallengeStatus(spec, 2, false)).toMatchObject({
      progress: 2,
      completed: false,
      claimed: false,
    });
    expect(dailyChallengeStatus(spec, 7, true)).toMatchObject({
      progress: 5, // saturado na meta
      completed: true,
      claimed: true,
    });
  });
});
