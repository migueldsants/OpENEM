import { buildStudyQueue, reviewFlashcard } from './flashcard-queue';

const NOW = new Date('2026-08-21T12:00:00Z');
const HOUR = 3_600_000;
const DAY = 86_400_000;

function item(partial: Partial<Parameters<typeof buildStudyQueue>[0][0]>) {
  return {
    flashcardId: 'fc-1',
    front: 'Q',
    back: 'A',
    deckTitle: 'Deck',
    deckIcon: '📚',
    weight: 3,
    easeFactor: 2.5,
    intervalD: 0,
    repetition: 0,
    dueAt: NOW,
    overdue: true,
    ...partial,
  };
}

describe('buildStudyQueue()', () => {
  it('vencidos vêm sempre à frente de não-vencidos, independente do peso', () => {
    const queue = buildStudyQueue([
      item({
        weight: 5,
        overdue: false,
        dueAt: new Date(NOW.getTime() + DAY),
      }),
      item({
        weight: 1,
        overdue: true,
        dueAt: new Date(NOW.getTime() - DAY),
      }),
    ]);
    expect(queue[0].flashcardId).toBe('fc-1'); // o vencido
    expect(queue[1].flashcardId).toBe('fc-1'); // o não-vencido
    expect(queue[0].overdue).toBe(true);
    expect(queue[1].overdue).toBe(false);
    expect(queue).toHaveLength(2);
  });

  it('entre vencidos, maior peso (Pareto) vem primeiro', () => {
    const queue = buildStudyQueue([
      item({ flashcardId: 'low', weight: 1, overdue: true }),
      item({ flashcardId: 'high', weight: 5, overdue: true }),
      item({ flashcardId: 'mid', weight: 3, overdue: true }),
    ]);
    expect(queue.map((q) => q.flashcardId)).toEqual(['high', 'mid', 'low']);
  });

  it('entre mesmo peso, vencido há mais tempo vem primeiro', () => {
    const queue = buildStudyQueue([
      item({
        flashcardId: 'newer',
        weight: 5,
        dueAt: new Date(NOW.getTime() - HOUR),
      }),
      item({
        flashcardId: 'older',
        weight: 5,
        dueAt: new Date(NOW.getTime() - 3 * DAY),
      }),
    ]);
    expect(queue[0].flashcardId).toBe('older');
    expect(queue[1].flashcardId).toBe('newer');
  });

  it('retorna todos os cards (sem limite)', () => {
    const queue = buildStudyQueue(
      Array.from({ length: 25 }, (_, i) =>
        item({ flashcardId: `fc-${i}`, weight: 3, overdue: true }),
      ),
    );
    expect(queue).toHaveLength(25);
  });

  it('não-vencidos preenchem a fila após os vencidos', () => {
    const queue = buildStudyQueue([
      item({
        flashcardId: 'overdue',
        weight: 3,
        overdue: true,
        dueAt: new Date(NOW.getTime() - DAY),
      }),
      item({
        flashcardId: 'future',
        weight: 3,
        overdue: false,
        dueAt: new Date(NOW.getTime() + DAY),
      }),
    ]);
    expect(queue).toHaveLength(2);
    expect(queue[0].flashcardId).toBe('overdue');
    expect(queue[1].flashcardId).toBe('future');
  });
});

describe('reviewFlashcard() — intervalos fixos por nota', () => {
  const base = { easeFactor: 2.5, intervalD: 10, repetition: 4 };

  it('Esqueci (1) é imediato: vence hoje e reinicia a contagem', () => {
    const next = reviewFlashcard(base, 1, NOW);
    expect(next.intervalD).toBe(0);
    expect(next.dueAt.getTime()).toBe(NOW.getTime());
    expect(next.repetition).toBe(0);
  });

  it('Difícil (3) agenda para 1 dia', () => {
    const next = reviewFlashcard(base, 3, NOW);
    expect(next.intervalD).toBe(1);
    expect(next.dueAt.getTime()).toBe(NOW.getTime() + DAY);
  });

  it('Bom (4) agenda para 3 dias', () => {
    const next = reviewFlashcard(base, 4, NOW);
    expect(next.intervalD).toBe(3);
    expect(next.dueAt.getTime()).toBe(NOW.getTime() + 3 * DAY);
  });

  it('Fácil (5) agenda para 7 dias', () => {
    const next = reviewFlashcard(base, 5, NOW);
    expect(next.intervalD).toBe(7);
    expect(next.dueAt.getTime()).toBe(NOW.getTime() + 7 * DAY);
  });

  it('intervalo não cresce com repetições (sempre fixo)', () => {
    const first = reviewFlashcard(
      { easeFactor: 2.5, intervalD: 0, repetition: 0 },
      5,
      NOW,
    );
    const tenth = reviewFlashcard(
      { easeFactor: 2.5, intervalD: 7, repetition: 10 },
      5,
      NOW,
    );
    expect(first.intervalD).toBe(7);
    expect(tenth.intervalD).toBe(7);
    expect(tenth.repetition).toBe(11);
  });

  it('easeFactor continua sendo ajustado (telemetria), com piso 1.3', () => {
    const hard = reviewFlashcard(base, 1, NOW);
    expect(hard.easeFactor).toBeLessThan(base.easeFactor);
    const floored = reviewFlashcard(
      { easeFactor: 1.3, intervalD: 0, repetition: 0 },
      1,
      NOW,
    );
    expect(floored.easeFactor).toBe(1.3);
  });
});