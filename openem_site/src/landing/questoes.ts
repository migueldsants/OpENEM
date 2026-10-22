/**
 * Questões oficiais respondíveis na landing. Texto copiado do caderno (via o
 * dataset que o app importa), sem reescrever; a resolução é do OpENEM.
 */

export type Area = 'mat' | 'nat' | 'hum' | 'lin' | 'red';

export interface QuestaoDemo {
  id: string;
  area: Area;
  materia: string;
  prova: string;
  numero: number;
  /** Parágrafos do enunciado. */
  enunciado: string[];
  /** Fonte citada no caderno, quando há. */
  fonte?: string;
  comando: string;
  alternativas: { letra: 'A' | 'B' | 'C' | 'D' | 'E'; texto: string }[];
  correta: 'A' | 'B' | 'C' | 'D' | 'E';
  resolucao: string;
}

export const QUESTOES: QuestaoDemo[] = [
  {
    id: 'enem-2024-137',
    area: 'mat',
    materia: 'Matemática',
    prova: 'ENEM 2024',
    numero: 137,
    enunciado: [
      'Ao calcular a média de suas notas em 4 provas, um estudante dividiu, por engano, a soma das notas por 5. Com isso, a média obtida foi 1 unidade menor do que deveria ser, caso fosse calculada corretamente.',
    ],
    comando: 'O valor correto da média das notas desse estudante é',
    alternativas: [
      { letra: 'A', texto: '4.' },
      { letra: 'B', texto: '5.' },
      { letra: 'C', texto: '6.' },
      { letra: 'D', texto: '19.' },
      { letra: 'E', texto: '21.' },
    ],
    correta: 'B',
    resolucao:
      'Chame de S a soma das notas. As duas médias diferem em 1: S/4 − S/5 = 1, ou seja, S/20 = 1 e S = 20. A média correta é 20 ÷ 4 = 5.',
  },
  {
    id: 'enem-2023-95',
    area: 'nat',
    materia: 'Ciências da Natureza',
    prova: 'ENEM 2023',
    numero: 95,
    enunciado: [
      'As aves apresentam dois tipos de músculos em seus corpos: vermelhos e brancos. Aves migratórias como garças, gansos e patos selvagens têm os músculos vermelhos bem desenvolvidos, com ampla rede de vasos sanguíneos.',
    ],
    comando: 'Nas viagens por grandes distâncias, tais músculos são fundamentais, pois favorecem o(a)',
    alternativas: [
      { letra: 'A', texto: 'Execução de manobras.' },
      { letra: 'B', texto: 'Metabolismo corpóreo elevado.' },
      { letra: 'C', texto: 'Manutenção da aerodinâmica.' },
      { letra: 'D', texto: 'Deslocamento a grandes velocidades.' },
      { letra: 'E', texto: 'Capacidade de voo em grandes altitudes.' },
    ],
    correta: 'B',
    resolucao:
      'Muitos vasos levam muito oxigênio: o músculo vermelho produz energia de forma contínua, por respiração aeróbica. É isso que sustenta o metabolismo alto de um voo longo.',
  },
  {
    id: 'enem-2018-79',
    area: 'hum',
    materia: 'Ciências Humanas',
    prova: 'ENEM 2018',
    numero: 79,
    enunciado: ['A quem não basta pouco, nada basta.'],
    fonte: 'EPICURO. Os pensadores. São Paulo: Abril Cultural, 1985.',
    comando:
      'Remanescente do período helenístico, a máxima apresentada valoriza a seguinte virtude:',
    alternativas: [
      { letra: 'A', texto: 'Esperança, tida como confiança no porvir.' },
      { letra: 'B', texto: 'Justiça, interpretada como retidão de caráter.' },
      { letra: 'C', texto: 'Temperança, marcada pelo domínio da vontade.' },
      { letra: 'D', texto: 'Coragem, definida como fortitude na dificuldade.' },
      { letra: 'E', texto: 'Prudência, caracterizada pelo correto uso da razão.' },
    ],
    correta: 'C',
    resolucao:
      'A máxima elogia quem se contenta com pouco, isto é, quem domina os próprios desejos. Esse domínio é a temperança, virtude central para os epicuristas.',
  },
];

/** Próxima questão da roda (volta para a primeira depois da última). */
export function proximaQuestao(atual: number, total = QUESTOES.length): number {
  return (atual + 1) % total;
}

/** Ano da prova de uma questão ("ENEM 2024" → 2024). */
export function anoDaQuestao(q: Pick<QuestaoDemo, 'prova'>): number {
  return Number(q.prova.match(/\d{4}/)?.[0]);
}

/** Todos os anos com ENEM, de 1998 a 2025, para a faixa da hero. */
export const ANOS_DO_ENEM: number[] = Array.from({ length: 2025 - 1998 + 1 }, (_, i) => 1998 + i);
