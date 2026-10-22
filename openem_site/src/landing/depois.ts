/**
 * O que o app faz depois que o aluno responde: cada aba é uma tela real do
 * app, com captura de desktop e de celular nos dois lados do tema.
 */

export interface TelaDoApp {
  id: string;
  /** Rótulo curto da aba. */
  aba: string;
  titulo: string;
  texto: string;
  /** Descrição da captura para leitores de tela. */
  alt: string;
}

export const TELAS: TelaDoApp[] = [
  {
    id: 'revisao',
    aba: 'Revisão',
    titulo: 'O que você errou volta na hora certa.',
    texto:
      'Cada questão respondida agenda o assunto para revisar. Errou, ele volta no dia seguinte; acertou, o intervalo cresce.',
    alt: 'Tela de Revisão do OpENEM com os assuntos atrasados, cada um com o botão Revisar.',
  },
  {
    id: 'questoes',
    aba: 'Questões',
    titulo: 'Questões do assunto em que você mais erra.',
    texto:
      'O app recomenda questões oficiais a partir dos seus erros recentes. Também dá para filtrar por prova, ano, matéria e assunto.',
    alt: 'Tela de Questões do OpENEM com a questão 137 do ENEM 2024 aberta.',
  },
  {
    id: 'flashcards',
    aba: 'Flashcards',
    titulo: 'Flashcards que voltam no dia certo.',
    texto: 'Baralhos prontos de todas as áreas, com revisão espaçada, e espaço para criar os seus.',
    alt: 'Tela de Flashcards do OpENEM com os baralhos por área.',
  },
  {
    id: 'desempenho',
    aba: 'Desempenho',
    titulo: 'A semana inteira numa tela.',
    texto:
      'Dias estudados contra a sua meta, acerto por área e os assuntos para praticar primeiro, semana a semana.',
    alt: 'Tela de Desempenho do OpENEM com a semana atual, o acerto por área e os assuntos para praticar.',
  },
];

/** Aba vizinha para a navegação por setas (dá a volta nas pontas). */
export function abaVizinha(atual: number, passo: 1 | -1, total = TELAS.length): number {
  return (atual + passo + total) % total;
}
