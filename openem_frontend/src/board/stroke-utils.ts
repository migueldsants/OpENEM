// Helpers de traço compartilhados por render.tsx (JSX) e export.ts (string),
// para evitar divergência entre as duas representações. Puros, sem React/DOM.

import { getStroke } from 'perfect-freehand';
import type { BoardElement } from './types';

/** Opções do perfect-freehand conforme o elemento (caneta vs marca-texto). */
export function strokeOptions(el: BoardElement) {
  const sw = el.strokeWidth ?? 2;
  const hasPressure = (el.points ?? []).some((p) => typeof p.p === 'number');
  if (el.highlight) {
    return {
      size: sw + 10,
      thinning: 0,
      smoothing: 0.5,
      streamline: 0.4,
      simulatePressure: false,
      last: true,
    } as const;
  }
  return {
    size: sw * 2.2 + 2,
    thinning: 0.6,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: !hasPressure,
    last: true,
  } as const;
}

/** Constrói o contorno do traço (perfect-freehand) e devolve o `d` do path. */
export function strokeOutlineD(el: BoardElement): string {
  const points = (el.points ?? []).map((p) =>
    typeof p.p === 'number'
      ? { x: p.x, y: p.y, pressure: p.p }
      : { x: p.x, y: p.y },
  );
  const outline = getStroke(points, strokeOptions(el));
  if (outline.length === 0) return '';
  return (
    outline
      .map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt[0]} ${pt[1]}`)
      .join(' ') + ' Z'
  );
}

/** Path do losango (4 vértices meio-borda). */
export function diamondPathD(el: BoardElement): string {
  const cx = el.x + el.w / 2;
  const cy = el.y + el.h / 2;
  return `M ${cx} ${el.y} L ${el.x + el.w} ${cy} L ${cx} ${el.y + el.h} L ${el.x} ${cy} Z`;
}

// --- Pontas de linha/seta (marcadores SVG por elemento) ---
// Única fonte p/ render (JSX) e export (string): evita a divergência de cor
// entre context-stroke (render) e --muted (export antigo). A cor é resolvida no
// chamador e "assada" dentro do marcador.

export type ArrowStyle = 'none' | 'arrow' | 'dot' | 'bar';
export const ARROW_STYLES: readonly ArrowStyle[] = ['none', 'arrow', 'dot', 'bar'];

/** Id do marcador (único por elemento + ponta). */
export function arrowMarkerId(elId: string, end: 'start' | 'end'): string {
  return `ah-${elId}-${end}`;
}

/** Estilo efetivo de uma ponta (respeita defaults: arrow→'arrow', line→'none'). */
export function resolveArrow(el: BoardElement, end: 'start' | 'end'): ArrowStyle {
  const v = end === 'start' ? el.arrowStart : el.arrowEnd;
  if (v && ARROW_STYLES.includes(v)) return v;
  return el.kind === 'arrow' && end === 'end' ? 'arrow' : 'none';
}

/** Markup interno do marcador (path/circle) já com a cor assada. String SVG. */
export function arrowMarkerInnerSvg(style: ArrowStyle, color: string): string {
  switch (style) {
    case 'arrow':
      return `<path d="M 0 0 L 10 5 L 0 10 z" fill="${color}"/>`;
    case 'dot':
      return `<circle cx="5" cy="5" r="3" fill="${color}"/>`;
    case 'bar':
      return `<path d="M 0 0 L 0 10" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round"/>`;
    default:
      return '';
  }
}

/** Definição completa `<marker>...</marker>` para o `<defs>` (export string). */
export function arrowMarkerDefSvg(
  elId: string,
  end: 'start' | 'end',
  style: ArrowStyle,
  color: string,
): string {
  if (style === 'none') return '';
  return `<marker id="${arrowMarkerId(elId, end)}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">${arrowMarkerInnerSvg(style, color)}</marker>`;
}