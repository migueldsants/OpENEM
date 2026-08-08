// Quadro de Estudos — editor (issue #32). Engine custom: camada vetorial SVG
// (BoardSVG) + overlay <canvas> para o traço livre ativo + seleção/redimensiona/
// giro em coords do mundo. Undo/redo por snapshots. Zoom/pan. Fórmula via
// MathLive (lazy) + KaTeX. Sem libs de cena externas.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  IconArrow,
  IconCursor,
  IconEllipse,
  IconEraser,
  IconFormula,
  IconHand,
  IconHighlighter,
  IconImage,
  IconLine,
  IconMind,
  IconPen,
  IconRect,
  IconSticky,
  IconText,
} from '../components/icons';
import { cryptoRandomId } from './serialize';
import { BoardSVG } from './render';
import { Katex } from './Katex';
import { MathField } from './MathField';
import type { Board, BoardElement, Point } from './types';
import {
  clamp,
  elementCenter,
  hitTest,
  moveElement,
  resizeElement,
  screenToWorld,
  snap as snapVal,
  type ResizeHandle,
} from './transform';

export type Tool =
  | 'select'
  | 'pen'
  | 'highlighter'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'text'
  | 'formula'
  | 'sticky'
  | 'mindnode'
  | 'image'
  | 'eraser'
  | 'pan';

const WORLD_W = 2000;
const WORLD_H = 1400;
const GRID = 20;

const COLORS = [
  '#e0234e',
  '#2563eb',
  '#16a34a',
  '#b45309',
  '#7c3aed',
  '#0f172a',
  '#6b6473',
];
const WIDTHS = [1, 2, 4, 8];
const FONT_SIZES = [14, 18, 24, 32];

const TOOLS: { tool: Tool; label: string; Icon: typeof IconCursor }[] = [
  { tool: 'select', label: 'Selecionar', Icon: IconCursor },
  { tool: 'pen', label: 'Lápis', Icon: IconPen },
  { tool: 'highlighter', label: 'Marca-texto', Icon: IconHighlighter },
  { tool: 'rect', label: 'Retângulo', Icon: IconRect },
  { tool: 'ellipse', label: 'Elipse', Icon: IconEllipse },
  { tool: 'line', label: 'Linha', Icon: IconLine },
  { tool: 'arrow', label: 'Seta', Icon: IconArrow },
  { tool: 'text', label: 'Texto', Icon: IconText },
  { tool: 'formula', label: 'Fórmula', Icon: IconFormula },
  { tool: 'sticky', label: 'Sticky', Icon: IconSticky },
  { tool: 'mindnode', label: 'Mapa mental', Icon: IconMind },
  { tool: 'image', label: 'Imagem', Icon: IconImage },
  { tool: 'eraser', label: 'Borracha', Icon: IconEraser },
  { tool: 'pan', label: 'Mover', Icon: IconHand },
];

interface DragState {
  mode: 'move' | 'resize' | 'rotate' | 'draw' | 'stroke' | 'pan';
  startWorld: Point;
  startPan: Point;
  startEl: BoardElement | null;
  handle?: ResizeHandle;
  draftId?: string;
  points?: Point[];
}

export function QuadroEditor({
  board,
  onChange,
}: {
  board: Board;
  onChange: (b: Board) => void;
}) {
  const [elements, setElementsState] = useState<BoardElement[]>(board.elements);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingKind, setEditingKind] = useState<'text' | 'formula' | null>(null);
  const [tool, setTool] = useState<Tool>('select');
  const [color, setColor] = useState<string>(COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState<number>(2);
  const [fontSize, setFontSize] = useState<number>(18);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [snapOn, setSnapOn] = useState(false);
  const [past, setPast] = useState<BoardElement[][]>([]);
  const [future, setFuture] = useState<BoardElement[][]>([]);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const spaceRef = useRef(false);

  // Sincroniza board externo → estado interno (quando abre outro quadro).
  useEffect(() => {
    setElementsState(board.elements);
    setPast([]);
    setFuture([]);
    setSelectedId(null);
  }, [board.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const emit = useCallback(
    (els: BoardElement[]) => {
      onChange({ ...board, elements: els, updatedAt: new Date().toISOString() });
    },
    [board, onChange],
  );

  /** Confirma uma mudança nos elementos (grava histórico). */
  const commit = useCallback(
    (els: BoardElement[]) => {
      setPast((p) => [...p.slice(-49), elements]);
      setFuture([]);
      setElementsState(els);
      emit(els);
    },
    [elements, emit],
  );

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      const prev = p[p.length - 1];
      setFuture((f) => [elements, ...f]);
      setElementsState(prev);
      emit(prev);
      setSelectedId(null);
      return p.slice(0, -1);
    });
  }, [elements, emit]);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      setPast((p) => [...p, elements]);
      setElementsState(next);
      emit(next);
      setSelectedId(null);
      return f.slice(1);
    });
  }, [elements, emit]);

  // Atalhos de teclado.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editingId) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId) {
          commit(elements.filter((el) => el.id !== selectedId));
          setSelectedId(null);
        }
      } else if (e.code === 'Space') {
        spaceRef.current = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceRef.current = false;
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [undo, redo, commit, elements, selectedId, editingId]);

  const toWorld = useCallback(
    (clientX: number, clientY: number): Point => {
      const rect = viewportRef.current!.getBoundingClientRect();
      const local = { x: clientX - rect.left, y: clientY - rect.top };
      return screenToWorld(local, pan, zoom);
    },
    [pan, zoom],
  );

  const snapPoint = useCallback(
    (p: Point): Point => ({
      x: snapOn ? snapVal(p.x, GRID) : p.x,
      y: snapOn ? snapVal(p.y, GRID) : p.y,
    }),
    [snapOn],
  );

  const selected = elements.find((e) => e.id === selectedId) ?? null;

  // --- Canvas overlay (traço livre ativo) ---
  // canvas está DENTRO do mundo transformado, então desenhamos em coords do
  // mundo (sem aplicar pan/zoom — o pai já aplica o transform via CSS).
  const drawStrokeCanvas = useCallback(
    (pts: Point[]) => {
      const canvas = canvasRef.current;
      if (!canvas || pts.length === 0) return;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = color;
      ctx.lineWidth = tool === 'highlighter' ? strokeWidth + 6 : strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = tool === 'highlighter' ? 0.35 : 1;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    },
    [color, strokeWidth, tool],
  );

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  // --- Pointer handlers ---

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (editingId) return;
      const world = snapPoint(toWorld(e.clientX, e.clientY));
      (e.target as Element).setPointerCapture?.(e.pointerId);

      // Pan: tool pan ou espaço pressionado ou botão do meio.
      if (tool === 'pan' || spaceRef.current || e.button === 1) {
        dragRef.current = {
          mode: 'pan',
          startWorld: { x: e.clientX, y: e.clientY },
          startPan: { ...pan },
          startEl: null,
        };
        return;
      }

      if (tool === 'select') {
        // hit-test topmost
        const hit = [...elements].reverse().find((el) => hitTest(el, world));
        if (hit) {
          setSelectedId(hit.id);
          dragRef.current = {
            mode: 'move',
            startWorld: world,
            startPan: pan,
            startEl: hit,
          };
        } else {
          setSelectedId(null);
        }
        return;
      }

      if (tool === 'eraser') {
        const hit = [...elements].reverse().find((el) => hitTest(el, world));
        if (hit) {
          commit(elements.filter((el) => el.id !== hit.id));
        }
        return;
      }

      if (tool === 'pen' || tool === 'highlighter') {
        const id = cryptoRandomId();
        dragRef.current = {
          mode: 'stroke',
          startWorld: world,
          startPan: pan,
          startEl: null,
          draftId: id,
          points: [world],
        };
        return;
      }

      if (tool === 'image') {
        fileInputRef.current?.click();
        return;
      }

      if (tool === 'text' || tool === 'sticky' || tool === 'mindnode' || tool === 'formula') {
        const id = cryptoRandomId();
        const w = tool === 'text' ? 200 : tool === 'mindnode' ? 140 : tool === 'formula' ? 160 : 160;
        const h = tool === 'text' ? 40 : tool === 'mindnode' ? 44 : tool === 'formula' ? 48 : 100;
        const el: BoardElement = {
          id,
          kind: tool,
          x: world.x,
          y: world.y,
          w,
          h,
          color,
          strokeWidth,
          fontSize,
          text: tool === 'formula' ? undefined : '',
          latex: tool === 'formula' ? 'x' : undefined,
          fill:
            tool === 'sticky'
              ? '#fff7cc'
              : tool === 'mindnode'
                ? color
                : undefined,
        };
        commit([...elements, el]);
        setSelectedId(id);
        setEditingId(id);
        setEditingKind(tool === 'formula' ? 'formula' : 'text');
        return;
      }

      // shapes (rect/ellipse/line/arrow)
      const id = cryptoRandomId();
      const el: BoardElement = {
        id,
        kind: tool,
        x: world.x,
        y: world.y,
        w: 0,
        h: 0,
        color,
        strokeWidth,
      };
      dragRef.current = {
        mode: 'draw',
        startWorld: world,
        startPan: pan,
        startEl: el,
        draftId: id,
      };
      setElementsState([...elements, el]); // preview sem histórico
    },
    [tool, elements, pan, toWorld, snapPoint, commit, color, strokeWidth, fontSize, editingId],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      if (drag.mode === 'pan') {
        const dx = e.clientX - drag.startWorld.x;
        const dy = e.clientY - drag.startWorld.y;
        setPan({ x: drag.startPan.x + dx, y: drag.startPan.y + dy });
        return;
      }
      const world = snapPoint(toWorld(e.clientX, e.clientY));

      if (drag.mode === 'move' && drag.startEl) {
        const dx = world.x - drag.startWorld.x;
        const dy = world.y - drag.startWorld.y;
        setElementsState((els) =>
          els.map((el) =>
            el.id === drag.startEl!.id ? moveElement(el, dx, dy) : el,
          ),
        );
        return;
      }
      if (drag.mode === 'resize' && drag.startEl && drag.handle) {
        const dx = world.x - drag.startWorld.x;
        const dy = world.y - drag.startWorld.y;
        const startEl = drag.startEl;
        const handle = drag.handle;
        setElementsState((els) =>
          els.map((el) =>
            el.id === startEl.id ? resizeElement(startEl, handle, dx, dy) : el,
          ),
        );
        return;
      }
      if (drag.mode === 'rotate' && drag.startEl) {
        const center = elementCenter(drag.startEl);
        const ang =
          (Math.atan2(world.y - center.y, world.x - center.x) * 180) / Math.PI +
          90;
        setElementsState((els) =>
          els.map((el) =>
            el.id === drag.startEl!.id ? { ...el, rotation: Math.round(ang) } : el,
          ),
        );
        return;
      }
      if (drag.mode === 'draw' && drag.startEl && drag.draftId) {
        const dx = world.x - drag.startWorld.x;
        const dy = world.y - drag.startWorld.y;
        setElementsState((els) =>
          els.map((el) =>
            el.id === drag.draftId
              ? { ...el, w: dx, h: dy }
              : el,
          ),
        );
        return;
      }
      if (drag.mode === 'stroke' && drag.points) {
        drag.points.push(world);
        drawStrokeCanvas(drag.points);
        return;
      }
    },
    [toWorld, snapPoint, drawStrokeCanvas],
  );

  const onPointerUp = useCallback(() => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    if (drag.mode === 'pan') return;

    if (drag.mode === 'move' || drag.mode === 'resize' || drag.mode === 'rotate') {
      // commit final state (history captura o estado pré-mudança)
      setElementsState((els) => {
        commit(els);
        return els;
      });
      return;
    }
    if (drag.mode === 'draw') {
      // remove se for muito pequeno; senão commita
      setElementsState((els) => {
        const el = els.find((x) => x.id === drag.draftId);
        if (!el || (Math.abs(el.w) < 4 && Math.abs(el.h) < 4)) {
          const filtered = els.filter((x) => x.id !== drag.draftId);
          setElementsState(filtered);
          return filtered;
        }
        // normaliza w/h positivos
        const norm = els.map((x) =>
          x.id === drag.draftId
            ? {
                ...x,
                w: Math.abs(x.w),
                h: Math.abs(x.h),
                x: x.w < 0 ? x.x + x.w : x.x,
                y: x.h < 0 ? x.y + x.h : x.y,
              }
            : x,
        );
        commit(norm);
        return norm;
      });
      return;
    }
    if (drag.mode === 'stroke' && drag.points && drag.points.length > 1) {
      clearCanvas();
      const xs = drag.points.map((p) => p.x);
      const ys = drag.points.map((p) => p.y);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      const el: BoardElement = {
        id: drag.draftId ?? cryptoRandomId(),
        kind: 'stroke',
        x,
        y,
        w: Math.max(...xs) - x,
        h: Math.max(...ys) - y,
        points: drag.points,
        color,
        strokeWidth,
        highlight: tool === 'highlighter',
      };
      commit([...elements, el]);
      return;
    }
    if (drag.mode === 'stroke') clearCanvas();
  }, [commit, elements, color, strokeWidth, tool, clearCanvas]);

  // --- Zoom por wheel ---
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const rect = viewportRef.current!.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const newZoom = clamp(zoom * factor, 0.2, 4);
      // mantém o ponto sob o cursor estável
      const wx = (cx - pan.x) / zoom;
      const wy = (cy - pan.y) / zoom;
      setPan({ x: cx - wx * newZoom, y: cy - wy * newZoom });
      setZoom(newZoom);
    },
    [zoom, pan],
  );

  // --- Handles de seleção ---
  const startHandle = (
    e: React.PointerEvent,
    handle: ResizeHandle | 'rotate',
  ) => {
    e.stopPropagation();
    if (!selected) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = {
      mode: handle === 'rotate' ? 'rotate' : 'resize',
      startWorld: snapPoint(toWorld(e.clientX, e.clientY)),
      startPan: pan,
      startEl: selected,
      handle: handle === 'rotate' ? undefined : handle,
    };
  };

  // --- Imagem ---
  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      const img = new window.Image();
      img.onload = () => {
        const maxW = 400;
        const w = Math.min(maxW, img.naturalWidth || maxW);
        const h = (img.naturalHeight / (img.naturalWidth || 1)) * w || 300;
        const center = { x: WORLD_W / 2, y: WORLD_H / 2 };
        const el: BoardElement = {
          id: cryptoRandomId(),
          kind: 'image',
          x: center.x - w / 2,
          y: center.y - h / 2,
          w,
          h,
          src,
        };
        commit([...elements, el]);
        setSelectedId(el.id);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // --- Edição de texto/fórmula ---
  const commitEdit = (id: string, value: string) => {
    setElementsState((els) => {
      const next = els.map((el) =>
        el.id === id
          ? el.kind === 'formula'
            ? { ...el, latex: value }
            : { ...el, text: value }
          : el,
      );
      commit(next);
      return next;
    });
  };

  const renderFormula = (el: BoardElement) =>
    el.latex ? <Katex latex={el.latex} /> : null;

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-line bg-surface/80 px-2 py-1.5 backdrop-blur">
        <div className="seg">
          {TOOLS.map(({ tool: t, label, Icon }) => (
            <button
              key={t}
              type="button"
              title={label}
              data-active={tool === t}
              onClick={() => {
                setTool(t);
                if (t !== 'select') setSelectedId(null);
                if (t === 'image') fileInputRef.current?.click();
              }}
              className="grid size-8 place-items-center"
            >
              <Icon width={18} height={18} weight={tool === t ? 'fill' : 'duotone'} />
            </button>
          ))}
        </div>

        {/* Cores */}
        <div className="flex items-center gap-1 px-1">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              title="Cor"
              onClick={() => setColor(c)}
              className={`size-5 rounded-full border ${color === c ? 'ring-2 ring-brand' : 'border-line'}`}
              style={{ background: c }}
            />
          ))}
        </div>

        {/* Espessura */}
        <div className="seg">
          {WIDTHS.map((w) => (
            <button
              key={w}
              type="button"
              title={`Espessura ${w}`}
              data-active={strokeWidth === w}
              onClick={() => setStrokeWidth(w)}
              className="px-2 text-xs font-data"
            >
              {w}
            </button>
          ))}
        </div>

        {(tool === 'text' || tool === 'sticky' || tool === 'mindnode') && (
          <div className="seg">
            {FONT_SIZES.map((s) => (
              <button
                key={s}
                type="button"
                data-active={fontSize === s}
                onClick={() => setFontSize(s)}
                className="px-2 text-xs font-data"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            title="Desfazer"
            disabled={past.length === 0}
            onClick={undo}
            className="btn btn-ghost px-2 py-1 text-xs disabled:opacity-40"
          >
            ↶ Desfazer
          </button>
          <button
            type="button"
            title="Refazer"
            disabled={future.length === 0}
            onClick={redo}
            className="btn btn-ghost px-2 py-1 text-xs disabled:opacity-40"
          >
            ↷ Refazer
          </button>
          <button
            type="button"
            title="Snap à grade"
            data-active={snapOn}
            onClick={() => setSnapOn((s) => !s)}
            className="btn btn-ghost px-2 py-1 text-xs"
          >
            Snap
          </button>
          <div className="seg">
            <button type="button" onClick={() => setZoom((z) => clamp(z * 1.2, 0.2, 4))} className="px-2 text-xs">＋</button>
            <button type="button" className="px-2 font-data text-xs" disabled>{Math.round(zoom * 100)}%</button>
            <button type="button" onClick={() => setZoom((z) => clamp(z / 1.2, 0.2, 4))} className="px-2 text-xs">－</button>
            <button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="px-2 text-xs">100%</button>
          </div>
        </div>
      </div>

      {/* Viewport */}
      <div
        ref={viewportRef}
        className="relative flex-1 overflow-hidden bg-bg touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
        style={{ cursor: tool === 'pan' ? 'grab' : tool === 'select' ? 'default' : 'crosshair' }}
      >
        <div
          className="absolute left-0 top-0"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            width: WORLD_W,
            height: WORLD_H,
          }}
        >
          <BoardSVG
            board={{ ...board, elements }}
            width={WORLD_W}
            height={WORLD_H}
            renderFormula={renderFormula}
            showBackground
          />
          <canvas
            ref={canvasRef}
            width={WORLD_W}
            height={WORLD_H}
            className="pointer-events-none absolute left-0 top-0"
          />

          {/* Seleção + handles */}
          {tool === 'select' && selected && !editingId && (
            <SelectionHandles el={selected} onHandle={startHandle} />
          )}

          {/* Editor de texto inline */}
          {editingId && editingKind === 'text' && selected && (
            <InlineTextEditor
              el={selected}
              onCommit={(v) => {
                commitEdit(selected.id, v);
                setEditingId(null);
                setEditingKind(null);
              }}
            />
          )}

          {/* Editor de fórmula */}
          {editingId && editingKind === 'formula' && selected && (
            <div
              className="absolute z-10 w-72 rounded-xl border border-line bg-surface p-3 shadow-[var(--shadow)]"
              style={{ left: selected.x, top: selected.y + selected.h + 6 }}
            >
              <MathField
                value={selected.latex ?? ''}
                onChange={(v) => {
                  setElementsState((els) =>
                    els.map((el) => (el.id === selected.id ? { ...el, latex: v } : el)),
                  );
                }}
                onCommit={() => {
                  setElementsState((els) => {
                    const next = els.map((el) =>
                      el.id === selected.id ? { ...el, latex: selected.latex ?? '' } : el,
                    );
                    commit(next);
                    return next;
                  });
                  setEditingId(null);
                  setEditingKind(null);
                }}
              />
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={onPickImage}
          className="hidden"
        />
      </div>
    </div>
  );
}

// --- Handles de seleção (coords do mundo, rotacionam com o elemento) ---
function SelectionHandles({
  el,
  onHandle,
}: {
  el: BoardElement;
  onHandle: (e: React.PointerEvent, h: ResizeHandle | 'rotate') => void;
}) {
  const rot = el.rotation ?? 0;
  const cx = el.x + el.w / 2;
  const cy = el.y + el.h / 2;
  const H = 9;
  const handles: { h: ResizeHandle; x: number; y: number }[] = [
    { h: 'nw', x: el.x, y: el.y },
    { h: 'n', x: cx, y: el.y },
    { h: 'ne', x: el.x + el.w, y: el.y },
    { h: 'e', x: el.x + el.w, y: cy },
    { h: 'se', x: el.x + el.w, y: el.y + el.h },
    { h: 's', x: cx, y: el.y + el.h },
    { h: 'sw', x: el.x, y: el.y + el.h },
    { h: 'w', x: el.x, y: cy },
  ];
  return (
    <g transform={`rotate(${rot} ${cx} ${cy})`} style={{ pointerEvents: 'all' }}>
      <rect
        x={el.x}
        y={el.y}
        width={el.w}
        height={el.h}
        fill="none"
        stroke="var(--brand)"
        strokeWidth={1.5}
        strokeDasharray="4 3"
      />
      {handles.map(({ h, x, y }) => (
        <rect
          key={h}
          x={x - H / 2}
          y={y - H / 2}
          width={H}
          height={H}
          rx={1.5}
          fill="var(--surface)"
          stroke="var(--brand)"
          strokeWidth={1.5}
          onPointerDown={(e) => onHandle(e, h)}
          style={{ cursor: 'nwse-resize' }}
        />
      ))}
      {/* handle de giro */}
      <line
        x1={cx}
        y1={el.y}
        x2={cx}
        y2={el.y - 26}
        stroke="var(--brand)"
        strokeWidth={1.5}
      />
      <circle
        cx={cx}
        cy={el.y - 30}
        r={6}
        fill="var(--surface)"
        stroke="var(--brand)"
        strokeWidth={1.5}
        onPointerDown={(e) => onHandle(e, 'rotate')}
        style={{ cursor: 'grab' }}
      />
    </g>
  );
}

// --- Editor de texto inline (textarea sobre o elemento) ---
function InlineTextEditor({
  el,
  onCommit,
}: {
  el: BoardElement;
  onCommit: (value: string) => void;
}) {
  const [value, setValue] = useState(el.text ?? '');
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onCommit(value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          onCommit(value);
        }
        if (e.key === 'Escape') onCommit(el.text ?? value);
      }}
      className="absolute resize-none rounded-lg border-2 border-brand bg-surface/95 p-1 text-fg outline-none"
      style={{
        left: el.x,
        top: el.y,
        width: Math.max(el.w, 80),
        height: Math.max(el.h, 28),
        fontSize: el.fontSize ?? 18,
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      }}
    />
  );
}