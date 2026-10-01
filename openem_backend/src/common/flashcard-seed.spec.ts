import { planDeckSync, type ExistingCard } from './flashcard-seed';

const card = (
  id: string,
  order: number,
  front: string,
  back = 'r',
): ExistingCard => ({
  id,
  order,
  front,
  back,
});

describe('planDeckSync', () => {
  it('não mexe em nada quando o banco já está igual ao seed', () => {
    const plan = planDeckSync(
      [card('a', 0, 'p1'), card('b', 1, 'p2')],
      [
        ['p1', 'r'],
        ['p2', 'r'],
      ],
    );
    expect(plan).toEqual({ create: [], update: [], remove: [] });
  });

  it('cria os cards que o seed ganhou no fim do deck', () => {
    const plan = planDeckSync(
      [card('a', 0, 'p1')],
      [
        ['p1', 'r'],
        ['p2', 'r2'],
      ],
    );
    expect(plan.create).toEqual([{ order: 1, front: 'p2', back: 'r2' }]);
    expect(plan.update).toEqual([]);
  });

  it('corrige o texto no mesmo registro, preservando o id (e o progresso)', () => {
    const plan = planDeckSync(
      [card('a', 0, 'enunciado com erro', 'resposta velha')],
      [['enunciado corrigido', 'resposta nova']],
    );
    expect(plan.update).toEqual([
      { id: 'a', front: 'enunciado corrigido', back: 'resposta nova' },
    ]);
    expect(plan.create).toEqual([]);
  });

  it('atualiza quando só a frente mudou', () => {
    const plan = planDeckSync([card('a', 0, 'velha', 'r')], [['nova', 'r']]);
    expect(plan.update).toEqual([{ id: 'a', front: 'nova', back: 'r' }]);
  });

  it('atualiza quando só o verso mudou', () => {
    const plan = planDeckSync([card('a', 0, 'p', 'velho')], [['p', 'novo']]);
    expect(plan.update).toEqual([{ id: 'a', front: 'p', back: 'novo' }]);
  });

  it('remove card de posição que saiu do seed', () => {
    const plan = planDeckSync(
      [card('a', 0, 'p1'), card('b', 1, 'p2')],
      [['p1', 'r']],
    );
    expect(plan.remove).toEqual(['b']);
  });

  it('com posição duplicada fica o primeiro registro e o resto sai', () => {
    const plan = planDeckSync(
      [card('a', 0, 'p1'), card('dup', 0, 'p1')],
      [['p1', 'r']],
    );
    expect(plan.remove).toEqual(['dup']);
    expect(plan.update).toEqual([]);
  });

  it('preenche buraco no meio sem renumerar os demais', () => {
    const plan = planDeckSync(
      [card('a', 0, 'p1'), card('c', 2, 'p3')],
      [
        ['p1', 'r'],
        ['p2', 'r'],
        ['p3', 'r'],
      ],
    );
    expect(plan.create).toEqual([{ order: 1, front: 'p2', back: 'r' }]);
    expect(plan.update).toEqual([]);
    expect(plan.remove).toEqual([]);
  });

  it('ordem negativa não casa com nenhuma posição e sai', () => {
    const plan = planDeckSync([card('x', -1, 'p')], [['p', 'r']]);
    expect(plan.remove).toEqual(['x']);
    expect(plan.create).toEqual([{ order: 0, front: 'p', back: 'r' }]);
  });
});
