import { answersToGrade } from './simulation-answers';

describe('answersToGrade', () => {
  describe('simulado com a lista de questões gravada', () => {
    const questoes = ['q1', 'q2', 'q3'];

    it('descarta questões que não fazem parte do simulado', () => {
      const res = answersToGrade(
        [
          { questionId: 'q1', chosenId: 'a1' },
          { questionId: 'intrusa', chosenId: 'x' },
          { questionId: 'q2', chosenId: 'b1' },
          { questionId: 'q3', chosenId: 'c1' },
        ],
        questoes,
      );
      expect(res.map((a) => a.questionId)).toEqual(['q1', 'q2', 'q3']);
    });

    it('questão não entregue entra em branco, na ordem da prova', () => {
      const res = answersToGrade(
        [{ questionId: 'q3', chosenId: 'c1', timeSpentSec: 12 }],
        questoes,
      );
      expect(res).toEqual([
        { questionId: 'q1' },
        { questionId: 'q2' },
        { questionId: 'q3', chosenId: 'c1', timeSpentSec: 12 },
      ]);
    });

    it('a mesma questão entregue várias vezes conta uma vez, com a última', () => {
      const res = answersToGrade(
        [
          { questionId: 'q1', chosenId: 'errada' },
          { questionId: 'q1', chosenId: 'certa', timeSpentSec: 30 },
        ],
        ['q1'],
      );
      expect(res).toEqual([
        { questionId: 'q1', chosenId: 'certa', timeSpentSec: 30 },
      ]);
    });

    it('entrega só com intrusas vira um simulado todo em branco', () => {
      const res = answersToGrade(
        [{ questionId: 'intrusa', chosenId: 'x' }],
        ['q1', 'q2'],
      );
      expect(res).toEqual([{ questionId: 'q1' }, { questionId: 'q2' }]);
    });
  });

  describe('simulado antigo, sem a lista gravada', () => {
    it('corrige o que foi entregue, uma vez por questão', () => {
      const res = answersToGrade(
        [
          { questionId: 'q1', chosenId: 'a1' },
          { questionId: 'q2', chosenId: 'b1' },
          { questionId: 'q1', chosenId: 'a2' },
        ],
        [],
      );
      // A posição é a da primeira entrega; a resposta, a da última.
      expect(res).toEqual([
        { questionId: 'q1', chosenId: 'a2' },
        { questionId: 'q2', chosenId: 'b1' },
      ]);
    });

    it('entrega vazia não gera correção', () => {
      expect(answersToGrade([], [])).toEqual([]);
    });
  });
});
