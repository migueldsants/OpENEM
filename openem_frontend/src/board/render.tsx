// Renderizador SVG puro do quadro — única fonte de verdade para a geometria,
// reutilizado pelo editor (camada vetorial), thumbnails da galeria e export.
// Não importa KaTeX: a fórmula é desenhada via callback `renderFormula`, que o
// editor provê (KaTeX) e a galeria provê (texto simples) — mantendo o KaTeX
// fora do chunk principal.

import type { Board, BoardElement } from './types';
import { GRID } from './types';
import { diamondPathD, strokeOutlineD, arrowMarkerId, arrowMarkerInnerSvg, resolveArrow, type ArrowStyle } from './stroke-utils';

export function RenderElement({
  el,
  renderFormula,
}: {
  el: BoardElement;
  renderFormula?: (el: BoardElement) => React.ReactNode;
}) {
  const stroke = el.color ?? 'currentColor';
  const sw = el.strokeWidth ?? 2;
  const rot = el.rotation ?? 0;
  const cx = el.x + el.w / 2;
  const cy = el.y + el.h / 2;
  const transform = rot ? `rotate(${rot} ${cx} ${cy})` : undefined;

  const wrap = (children: React.ReactNode) =>
    transform ? <g transform={transform}>{children}</g> : <>{children}</>;

  const markerRef = (end: 'start' | 'end', style: ArrowStyle) =>
    style === 'none' ? undefined : `url(#${arrowMarkerId(el.id, end)})`;

  switch (el.kind) {
    case 'rect':
      return wrap(
        <rect
          x={el.x}
          y={el.y}
          width={el.w}
          height={el.h}
          rx={4}
          fill={el.fill ?? 'none'}
          stroke={stroke}
          strokeWidth={sw}
        />,
      );
    case 'ellipse':
      return wrap(
        <ellipse
          cx={el.x + el.w / 2}
          cy={el.y + el.h / 2}
          rx={el.w / 2}
          ry={el.h / 2}
          fill={el.fill ?? 'none'}
          stroke={stroke}
          strokeWidth={sw}
        />,
      );
    case 'diamond':
      return wrap(
        <path
          d={diamondPathD(el)}
          fill={el.fill ?? 'none'}
          stroke={stroke}
          strokeWidth={sw}
          strokeLinejoin="round"
        />,
      );
    case 'line':
    case 'arrow': {
      const st = resolveArrow(el, 'start');
      const en = resolveArrow(el, 'end');
      return wrap(
        <line
          x1={el.x}
          y1={el.y}
          x2={el.x + el.w}
          y2={el.y + el.h}
          stroke={stroke}
          strokeWidth={sw}
          strokeLinecap="round"
          markerStart={markerRef('start', st)}
          markerEnd={markerRef('end', en)}
        />,
      );
    }
    case 'stroke': {
      const d = strokeOutlineD(el);
      if (!d) return null;
      return wrap(
        <path
          d={d}
          fill={stroke}
          fillOpacity={el.highlight ? 0.35 : 1}
          stroke="none"
        />,
      );
    }
    case 'text':
      return wrap(
        <text
          x={el.x}
          y={el.y}
          fill={stroke}
          fontSize={el.fontSize ?? 18}
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          dominantBaseline="text-before-edge"
        >
          {(el.text ?? '').split('\n').map((line, i) => (
            <tspan key={i} x={el.x} dy={i === 0 ? 0 : (el.fontSize ?? 18) * 1.2}>
              {line}
            </tspan>
          ))}
        </text>,
      );
    case 'sticky':
      return wrap(
        <g>
          <rect
            x={el.x}
            y={el.y}
            width={el.w}
            height={el.h}
            rx={6}
            fill={el.fill ?? '#fff7cc'}
            stroke={stroke}
            strokeWidth={1}
          />
          <foreignObject x={el.x + 6} y={el.y + 6} width={el.w - 12} height={el.h - 12}>
            <div
              style={{
                fontFamily: 'ui-sans-serif, system-ui, sans-serif',
                fontSize: el.fontSize ?? 14,
                color: el.textColor ?? '#5a4a1a',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {el.text}
            </div>
          </foreignObject>
        </g>,
      );
    case 'image':
      return wrap(
        el.src ? (
          <image
            href={el.src}
            x={el.x}
            y={el.y}
            width={el.w}
            height={el.h}
            preserveAspectRatio="xMidYMid meet"
          />
        ) : null,
      );
    case 'formula':
      return wrap(
        <foreignObject x={el.x} y={el.y} width={el.w} height={el.h}>
          {renderFormula
            ? renderFormula(el)
            : <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{el.latex}</span>}
        </foreignObject>,
      );
    default:
      return null;
  }
}

export function BoardSVG({
  board,
  width,
  height,
  viewBox,
  renderFormula,
  showBackground = true,
}: {
  board: Board;
  width?: number;
  height?: number;
  /** viewBox opcional (default = "0 0 width height"). Útil p/ thumbnails
   * mostrarem o canvas inteiro em escala (ex.: "0 0 2000 1400"). */
  viewBox?: string;
  renderFormula?: (el: BoardElement) => React.ReactNode;
  showBackground?: boolean;
}) {
  const bg = board.background ?? 'grid';
  const arrowEls = board.elements.filter((e) => e.kind === 'line' || e.kind === 'arrow');
  return (
    <svg
      width={width}
      height={height}
      viewBox={viewBox ?? `0 0 ${width ?? 1000} ${height ?? 700}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ background: showBackground ? 'var(--bg, #fff)' : 'transparent', display: 'block' }}
    >
      <defs>
        {arrowEls.flatMap((el) => {
          const color = el.color ?? 'currentColor';
          const ends: ('start' | 'end')[] = ['start', 'end'];
          return ends
            .map((end) => {
              const style = resolveArrow(el, end);
              if (style === 'none') return null;
              return (
                <marker
                  key={`${el.id}-${end}`}
                  id={arrowMarkerId(el.id, end)}
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                  dangerouslySetInnerHTML={{ __html: arrowMarkerInnerSvg(style, color) }}
                />
              );
            })
            .filter(Boolean);
        })}
        {showBackground && bg !== 'blank' && (
          <pattern
            id="board-bg"
            width={GRID}
            height={GRID}
            patternUnits="userSpaceOnUse"
          >
            {bg === 'dots' ? (
              <circle cx={2} cy={2} r={1.5} fill="var(--muted, #6b6473)" fillOpacity={0.3} />
            ) : (
              <path
                d={`M ${GRID} 0 L 0 0 0 ${GRID}`}
                fill="none"
                stroke="var(--muted, #6b6473)"
                strokeOpacity={0.22}
                strokeWidth="1"
              />
            )}
          </pattern>
        )}
      </defs>
      {showBackground && bg !== 'blank' && (
        <rect width="100%" height="100%" fill="url(#board-bg)" />
      )}
      {board.elements.map((el) => (
        <g key={el.id} data-id={el.id}>
          <RenderElement el={el} renderFormula={renderFormula} />
        </g>
      ))}
    </svg>
  );
}