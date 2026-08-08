// Modelo de dados do Quadro de Estudos (issue #32). Tudo serializável para o
// formato `.openem` e persistido localmente (IndexedDB → fallback localStorage).

export type ElKind =
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'text'
  | 'formula'
  | 'sticky'
  | 'mindnode'
  | 'image'
  | 'stroke';

/** Fundo do quadro. */
export type BoardBackground = 'grid' | 'dots' | 'blank';

export interface Point {
  x: number;
  y: number;
}

export interface BoardElement {
  id: string;
  kind: ElKind;
  /** Bounding box (canto superior esquerdo + dimensões). Para line/arrow, x,y
   * é a origem e w,h o delta até o ponto final. */
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  /** Traço livre (lápis/highlighter) — pontos em coords do mundo. */
  points?: Point[];
  /** Conteúdo textual (text/sticky/mindnode). */
  text?: string;
  /** LaTeX da fórmula (kind === 'formula'). */
  latex?: string;
  color?: string;
  fill?: string;
  strokeWidth?: number;
  fontSize?: number;
  /** Highlighter: traço grosso semi-transparente. */
  highlight?: boolean;
  /** Mapa mental: id do nó de destino da ligação (seta). */
  linkTo?: string;
  /** Imagem embutida como dataURL (kind === 'image'). */
  src?: string;
}

export interface Board {
  schemaVersion: 1;
  type: 'study-board';
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  background?: BoardBackground;
  elements: BoardElement[];
  /** Só em scratch vinculado a uma questão (botão "Anotar"). */
  questionId?: string;
}

export const BOARD_SCHEMA_VERSION = 1 as const;
export const BOARD_TYPE = 'study-board' as const;

/** Cria um quadro novo vazio. */
export function createBoard(
  init: Partial<Pick<Board, 'title' | 'background' | 'questionId'>> & {
    id: string;
  },
): Board {
  const now = new Date().toISOString();
  return {
    schemaVersion: BOARD_SCHEMA_VERSION,
    type: BOARD_TYPE,
    id: init.id,
    title: init.title ?? 'Quadro sem título',
    createdAt: now,
    updatedAt: now,
    background: init.background ?? 'grid',
    elements: [],
    questionId: init.questionId,
  };
}