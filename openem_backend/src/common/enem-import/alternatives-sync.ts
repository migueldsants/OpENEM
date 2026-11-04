/**
 * Como reimportar as alternativas de uma questão que já está no banco.
 * Puro e testado.
 *
 * `Answer.chosenId` guarda o id da alternativa e NÃO tem chave estrangeira:
 * apagar e recriar as alternativas deixa órfãs, em silêncio, as respostas que
 * os alunos já deram. Por isso, quando a questão continua com as mesmas
 * alternativas (mesma quantidade e a mesma letra em cada posição), o que mudou
 * — texto limpo de outro jeito, imagem, gabarito corrigido — é atualizado no
 * lugar e o id fica. Só uma mudança de estrutura (alternativa a mais ou a
 * menos, letras em outra ordem) recria.
 */

export interface AlternativeData {
  letter: string | null;
  text: string;
  imageUrl: string | null;
  isCorrect: boolean;
  position: number;
}

export type AlternativesPlan =
  | { kind: 'unchanged' }
  | {
      kind: 'update';
      updates: { id: string; data: Omit<AlternativeData, 'position'> }[];
    }
  | { kind: 'rebuild' };

export function planAlternativesSync(
  existentes: (AlternativeData & { id: string })[],
  novas: AlternativeData[],
): AlternativesPlan {
  const porPosicao = <T extends AlternativeData>(xs: T[]) =>
    [...xs].sort((a, b) => a.position - b.position);
  const antes = porPosicao(existentes);
  const depois = porPosicao(novas);

  const mesmaEstrutura =
    antes.length === depois.length &&
    antes.every(
      (a, i) =>
        a.position === depois[i].position && a.letter === depois[i].letter,
    );
  if (!mesmaEstrutura) return { kind: 'rebuild' };

  const updates = antes.flatMap((a, i) => {
    const n = depois[i];
    const igual =
      a.text === n.text &&
      a.imageUrl === n.imageUrl &&
      a.isCorrect === n.isCorrect;
    return igual
      ? []
      : [
          {
            id: a.id,
            data: {
              letter: n.letter,
              text: n.text,
              imageUrl: n.imageUrl,
              isCorrect: n.isCorrect,
            },
          },
        ];
  });
  return updates.length ? { kind: 'update', updates } : { kind: 'unchanged' };
}
