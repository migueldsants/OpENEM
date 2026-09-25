// Serialização do formato `.openem` (JSON versionado). Round-trip sem perda:
// o mesmo `Board` reabre editável.

import {
  BOARD_SCHEMA_VERSION,
  BOARD_TYPE,
  type Board,
} from './types';

/** Serializa um Board para string `.openem` (JSON). */
export function toOpenEm(board: Board): string {
  return JSON.stringify({
    schemaVersion: BOARD_SCHEMA_VERSION,
    type: BOARD_TYPE,
    id: board.id,
    title: board.title,
    createdAt: board.createdAt,
    updatedAt: board.updatedAt,
    background: board.background ?? 'grid',
    elements: board.elements,
    questionId: board.questionId,
  });
}

/** Erro amigável de import. */
export class OpenEmParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenEmParseError';
  }
}

/**
 * Faz parse de um texto `.openem` e valida o schema. Rejeita com mensagem
 * amigável se não for um arquivo válido ou a versão for incompatível.
 */
export function parseOpenEm(text: string): Board {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new OpenEmParseError('Arquivo .openem inválido (JSON malformado).');
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new OpenEmParseError('Arquivo .openem inválido (esperado um objeto).');
  }
  const obj = data as Record<string, unknown>;
  if (obj.type !== BOARD_TYPE) {
    throw new OpenEmParseError(
      'Arquivo .openem inválido: não é um quadro de estudos.',
    );
  }
  const version = obj.schemaVersion;
  if (typeof version !== 'number' || version !== BOARD_SCHEMA_VERSION) {
    throw new OpenEmParseError(
      `Versão .openem incompatível (esperada ${BOARD_SCHEMA_VERSION}, encontrada ${String(
        version,
      )}). Atualize o app.`,
    );
  }
  if (typeof obj.id !== 'string' || typeof obj.title !== 'string') {
    throw new OpenEmParseError('Arquivo .openem inválido (id/título ausentes).');
  }
  if (!Array.isArray(obj.elements)) {
    throw new OpenEmParseError('Arquivo .openem inválido (elements ausente).');
  }
  const now = new Date().toISOString();
  return {
    schemaVersion: BOARD_SCHEMA_VERSION,
    type: BOARD_TYPE,
    id: obj.id,
    title: obj.title,
    createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : now,
    updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : now,
    background:
      obj.background === 'grid' || obj.background === 'dots' || obj.background === 'blank'
        ? obj.background
        : 'grid',
    elements: (obj.elements as unknown[])
      .map((e) => normalizeElement(e as Record<string, unknown>))
      .filter((e) => (e.kind as string) !== 'mindnode'), // mapa mental foi removido
    questionId: typeof obj.questionId === 'string' ? obj.questionId : undefined,
  };
}

/** Normaliza um elemento cru do JSON, garantindo os campos mínimos. */
function normalizeElement(el: Record<string, unknown>): import('./types').BoardElement {
  const e = el as unknown as import('./types').BoardElement;
  return {
    id: typeof e.id === 'string' ? e.id : cryptoRandomId(),
    kind: e.kind ?? 'rect',
    x: Number(e.x) || 0,
    y: Number(e.y) || 0,
    w: Number(e.w) || 0,
    h: Number(e.h) || 0,
    rotation: typeof e.rotation === 'number' ? e.rotation : undefined,
    points: Array.isArray(e.points)
      ? (e.points as unknown[]).map((pt) => {
          const p = pt as Record<string, unknown>;
          return {
            x: Number(p.x) || 0,
            y: Number(p.y) || 0,
            ...(typeof p.p === 'number' ? { p: p.p } : {}),
          };
        })
      : undefined,
    text: typeof e.text === 'string' ? e.text : undefined,
    latex: typeof e.latex === 'string' ? e.latex : undefined,
    color: typeof e.color === 'string' ? e.color : undefined,
    fill: typeof e.fill === 'string' ? e.fill : undefined,
    textColor: typeof e.textColor === 'string' ? e.textColor : undefined,
    strokeWidth: typeof e.strokeWidth === 'number' ? e.strokeWidth : undefined,
    fontSize: typeof e.fontSize === 'number' ? e.fontSize : undefined,
    highlight: typeof e.highlight === 'boolean' ? e.highlight : undefined,
    arrowStart:
      e.arrowStart === 'none' || e.arrowStart === 'arrow' || e.arrowStart === 'dot' || e.arrowStart === 'bar'
        ? e.arrowStart
        : undefined,
    arrowEnd:
      e.arrowEnd === 'none' || e.arrowEnd === 'arrow' || e.arrowEnd === 'dot' || e.arrowEnd === 'bar'
        ? e.arrowEnd
        : undefined,
    src: typeof e.src === 'string' ? e.src : undefined,
  };
}

/** Gera um id curto e único o suficiente para nós/quadros locais. */
export function cryptoRandomId(): string {
  // crypto.randomUUID existe em browsers modernos e no jsdom; fallback numérico.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}