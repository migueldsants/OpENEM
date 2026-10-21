/**
 * A hora de estudo que a landing percorre. Cada etapa é um recurso real do
 * app, com o intervalo de minutos que ela ocupa na régua (0 a 60).
 */

export interface Etapa {
  id: string;
  inicio: number;
  fim: number;
  titulo: string;
  texto: string;
  /** Descrição da captura do app para leitores de tela. */
  alt: string;
}

export const ETAPAS: Etapa[] = [
  {
    id: 'revisao',
    inicio: 0,
    fim: 10,
    titulo: 'Comece pelo que você errou.',
    texto:
      'Cada questão respondida agenda o assunto para revisar. Errou, ele volta no dia seguinte; acertou, o intervalo cresce.',
    alt: 'Tela de Revisão do OpENEM com os assuntos que vencem hoje.',
  },
  {
    id: 'questoes',
    inicio: 10,
    fim: 35,
    titulo: 'Questões do assunto em que você mais erra.',
    texto:
      'O app recomenda questões oficiais a partir dos seus erros recentes. Também dá para filtrar por prova, ano, matéria e assunto.',
    alt: 'Tela de Questões do OpENEM com uma questão oficial aberta.',
  },
  {
    id: 'flashcards',
    inicio: 35,
    fim: 45,
    titulo: 'Flashcards que voltam no dia certo.',
    texto:
      'Baralhos prontos de todas as áreas, com revisão espaçada, e espaço para criar os seus.',
    alt: 'Tela de Flashcards do OpENEM com os baralhos por área.',
  },
  {
    id: 'redacao',
    inicio: 45,
    fim: 55,
    titulo: 'Os temas de redação de 1998 a 2025.',
    texto:
      'As 48 propostas oficiais, com os textos motivadores e a página do caderno, do jeito que caíram na prova.',
    alt: 'Tela de Redações do OpENEM com a lista de temas oficiais.',
  },
  {
    id: 'desempenho',
    inicio: 55,
    fim: 60,
    titulo: 'Feche o dia sabendo onde está errando.',
    texto: 'Acertos por matéria e por assunto, sua sequência de dias e as metas da semana.',
    alt: 'Tela de Desempenho do OpENEM com os acertos por matéria.',
  },
];

export const MINUTOS_DA_HORA = 60;

/**
 * Minuto marcado na régua: antes da primeira etapa (topo da página) é 0;
 * numa etapa, o minuto em que ela termina (a régua mostra o quanto da hora já
 * foi); depois da última, a hora fechada.
 */
export function minutoDaEtapa(indice: number, etapas: Etapa[] = ETAPAS): number {
  if (indice < 0) return 0;
  if (indice >= etapas.length) return MINUTOS_DA_HORA;
  return etapas[indice].fim;
}

/** Fração (0 a 1) da régua que corresponde a um minuto. */
export function fracaoDaRegua(minuto: number): number {
  return Math.min(1, Math.max(0, minuto / MINUTOS_DA_HORA));
}

/** Marcas da régua: a cada 5 minutos, com rótulo a cada 10. */
export function marcasDaRegua(): { minuto: number; rotulo: boolean }[] {
  const marcas = [];
  for (let m = 0; m <= MINUTOS_DA_HORA; m += 5) marcas.push({ minuto: m, rotulo: m % 10 === 0 });
  return marcas;
}
