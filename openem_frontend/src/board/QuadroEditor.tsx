// Quadro de Estudos — editor (issue #32). Engine custom: camada vetorial SVG
// (BoardSVG) + overlay <canvas> para o traço livre ativo + seleção/redimensiona/
// giro em coords do mundo. Canvas infinito (origem dinâmica + grade em tela).
// Undo/redo por snapshots. Zoom/pan + pinch. Fórmula via MathLive (lazy) + KaTeX.
// Traço via perfect-freehand com pressão de caneta/mesa. Sem libs de cena externas.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  IconArrow,
  IconCursor,
  IconDiamond,
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
import type { Board, BoardElement, EraserMode, Point } from './types';
import { GRID } from './types';
import {
  clamp,
  elementCenter,
  groupBBox,
  hitTest,
  marqueeSelect,
  moveElement,
  resizeElement,
  screenToWorld,
  splitStrokeAtEraser,
  snap as snapVal,
  type ResizeHandle,
} from './transform';

export type Tool =
  | 'select'
  | 'pen'
  | 'highlighter'
  | 'rect'
  | 'ellipse'
  | 'diamond'
  | 'line'
  | 'arrow'
  | 'text'
  | 'formula'
  | 'sticky'
  | 'mindnode'
  | 'image'
  | 'eraser'
  | 'pan';

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

const MARGIN = 800; // borda extra ao redor do conteúdo/viewport (canvas "infinito")
const MIN_W = 1600;
const MIN_H = 1200;

const TOOLS: { tool: Tool; label: string; Icon: typeof IconCursor; key?: string }[] = [
  { tool: 'select', label: 'Selecionar (V)', Icon: IconCursor, key: 'v' },
  { tool: 'pen', label: 'Lápis (P)', Icon: IconPen, key: 'p' },
  { tool: 'highlighter', label: 'Marca-texto', Icon: IconHighlighter },
  { tool: 'rect', label: 'Retângulo (R)', Icon: IconRect, key: 'r' },
  { tool: 'ellipse', label: 'Elipse (O)', Icon: IconEllipse, key: 'o' },
  { tool: 'diamond', label: 'Losango', Icon: IconDiamond },
  { tool: 'line', label: 'Linha (L)', Icon: IconLine, key: 'l' },
  { tool: 'arrow', label: 'Seta (A)', Icon: IconArrow, key: 'a' },
  { tool: 'text', label: 'Texto (T)', Icon: IconText, key: 't' },
  { tool: 'formula', label: 'Fórmula', Icon: IconFormula },
  { tool: 'sticky', label: 'Sticky', Icon: IconSticky },
  { tool: 'mindnode', label: 'Mapa mental', Icon: IconMind },
  { tool: 'image', label: 'Imagem', Icon: IconImage },
  { tool: 'eraser', label: 'Borracha (E)', Icon: IconEraser, key: 'e' },
  { tool: 'pan', label: 'Mover (H)', Icon: IconHand, key: 'h' },
];

const TOOL_KEYS: Record<string, Tool> = Object.fromEntries(
  TOOLS.map((t) => (t.key ? [t.key, t.tool] : [])).filter(Boolean),
);

interface DragState {
  mode: 'move' | 'resize' | 'rotate' | 'draw' | 'stroke' | 'pan' | 'marquee' | 'erase' | 'pinch';
  startWorld: Point;
  startPan: Point;
  startEl: BoardElement | null;
  startEls?: BoardElement[]; // snapshot p/ move de grupo
  handle?: ResizeHandle;
  draftId?: string;
  points?: Point[];
  marqueeRect?: { x: number; y: number; w: number; h: number };
  eraseIds?: Set<string>;
  eraseChanged?: boolean;
  moved?: boolean;
}

// Clipboard interno (escopo de módulo) — sobrevive a re-renders, sem async.
let clipboard: BoardElement[] = [];

function pressureOf(e: { pressure?: number; pointerType?: string }): number {
  if (e.pointerType === 'pen' && typeof e.pressure === 'number' && e.pressure > 0) {
    return e.pressure;
  }
  return 0.5;
}

export function QuadroEditor({
  board,
  onChange,
}: {
  board: Board;
  onChange: (b: Board) => void;
}) {
  const [elements, setElementsState] = useState<BoardElement[]>(board.elements);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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
  const [eraserMode, setEraserMode] = useState<EraserMode>('object');
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const preDragRef = useRef<BoardElement[] | null>(null);
  const spaceRef = useRef(false);
  const pointersRef = useRef<Map<number, Point>>(new Map());
  const pinchRef = useRef<{ dist: number; mid: Point; zoom: number; pan: Point } | null>(null);
  const centeredRef = useRef(false);

  // Sincroniza board externo → estado interno (quando abre outro quadro).
  useEffect(() => {
    setElementsState(board.elements);
    setPast([]);
    setFuture([]);
    setSelectedIds(new Set());
    centeredRef.current = false;
  }, [board.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const emit = useCallback(
    (els: BoardElement[]) => {
      onChange({ ...board, elements: els, updatedAt: new Date().toISOString() });
    },
    [board, onChange],
  );

  /** Confirma uma mudança nos elementos (grava histórico a partir do estado atual). */
  const commit = useCallback(
    (els: BoardElement[]) => {
      setPast((p) => [...p.slice(-49), elements]);
      setFuture([]);
      setElementsState(els);
      emit(els);
    },
    [elements, emit],
  );

  /** Confirma a partir de um snapshot explícito (pré-arrasto) — undo correto. */
  const commitFrom = useCallback(
    (prev: BoardElement[], next: BoardElement[]) => {
      setPast((p) => [...p.slice(-49), prev]);
      setFuture([]);
      setElementsState(next);
      emit(next);
    },
    [emit],
  );

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      const prev = p[p.length - 1];
      setFuture((f) => [elements, ...f]);
      setElementsState(prev);
      emit(prev);
      setSelectedIds(new Set());
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
      setSelectedIds(new Set());
      return f.slice(1);
    });
  }, [elements, emit]);

  const selected = useMemo(
    () => elements.filter((e) => selectedIds.has(e.id)),
    [elements, selectedIds],
  );
  const selectedSingle = selected.length === 1 ? selected[0] : null;

  // --- Atalhos de teclado ---
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editingId) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if (mod && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        clipboard = selected.map((el) => ({ ...el }));
      } else if (mod && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        paste();
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicate();
      } else if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelectedIds(new Set(elements.map((el) => el.id)));
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.size) {
          commitFrom(elements, elements.filter((el) => !selectedIds.has(el.id)));
          setSelectedIds(new Set());
        }
      } else if (e.key === 'Escape') {
        setSelectedIds(new Set());
        setTool('select');
      } else if (e.code === 'Space') {
        spaceRef.current = true;
      } else if (!mod && !spaceRef.current && TOOL_KEYS[e.key.toLowerCase()]) {
        const t = TOOL_KEYS[e.key.toLowerCase()];
        setTool(t);
        if (t !== 'select') setSelectedIds(new Set());
        if (t === 'image') fileInputRef.current?.click();
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
  }, [undo, redo, commitFrom, elements, selectedIds, editingId, selected]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Clipboard ---
  function paste(offset = 20) {
    if (clipboard.length === 0) return;
    const pasted = clipboard.map((el) => ({
      ...el,
      id: cryptoRandomId(),
      x: el.x + offset,
      y: el.y + offset,
      points: el.points?.map((p) => ({ x: p.x + offset, y: p.y + offset, ...(p.p != null ? { p: p.p } : {}) })),
    }));
    commitFrom(elements, [...elements, ...pasted]);
    setSelectedIds(new Set(pasted.map((p) => p.id)));
  }

  function duplicate() {
    if (selected.length === 0) return;
    clipboard = selected.map((el) => ({ ...el }));
    paste(20);
  }

  // --- Conversões de coordenada ---
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

  // --- Canvas infinito: bounds dinâmicos (conteúdo ∪ viewport visível) ---
  const worldBounds = useMemo(() => {
    const content = elements.length
      ? { x: Math.min(...elements.map((e) => e.x)), y: Math.min(...elements.map((e) => e.y)), w: 0, h: 0 }
      : { x: 0, y: 0, w: 0, h: 0 };
    if (elements.length) {
      content.w = Math.max(...elements.map((e) => e.x + e.w)) - content.x;
      content.h = Math.max(...elements.map((e) => e.y + e.h)) - content.y;
    }
    const visX = -pan.x / zoom;
    const visY = -pan.y / zoom;
    const visW = (vp.w || 1200) / zoom;
    const visH = (vp.h || 800) / zoom;
    const minX = Math.min(content.x, visX) - MARGIN;
    const minY = Math.min(content.y, visY) - MARGIN;
    const maxX = Math.max(content.x + content.w, visX + visW) + MARGIN;
    const maxY = Math.max(content.y + content.h, visY + visH) + MARGIN;
    return {
      x: minX,
      y: minY,
      w: Math.max(MIN_W, maxX - minX),
      h: Math.max(MIN_H, maxY - minY),
    };
  }, [elements, pan, zoom, vp]);

  const origin = { x: worldBounds.x, y: worldBounds.y };
  const originRef = useRef(origin);
  originRef.current = origin;

  // Observa tamanho do viewport (p/ bounds e centralização).
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const r0 = el.getBoundingClientRect();
    setVp({ w: r0.width, h: r0.height });
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setVp({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Centraliza o conteúdo uma vez ao abrir o quadro.
  useEffect(() => {
    if (centeredRef.current || vp.w === 0) return;
    if (elements.length === 0) {
      centeredRef.current = true;
      return;
    }
    const cx = elements.reduce((s, e) => s + e.x + e.w / 2, 0) / elements.length;
    const cy = elements.reduce((s, e) => s + e.y + e.h / 2, 0) / elements.length;
    setPan({ x: vp.w / 2 - cx, y: vp.h / 2 - cy });
    centeredRef.current = true;
  }, [vp, elements]);

  // --- Canvas overlay (traço livre ativo) ---
  // Durante o arrasto desenhamos apenas uma polyline simples no canvas: rápido,
  // O(1) por evento. O contorno suave do perfect-freehand é calculado só no
  // pointerUp, quando o traço é commitado para o SVG.
  const drawStrokeCanvas = useCallback(
    (pts: Point[]) => {
      const canvas = canvasRef.current;
      if (!canvas || pts.length === 0) return;
      const ctx = canvas.getContext('2d')!;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const o = originRef.current;
      ctx.translate(-o.x, -o.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = tool === 'highlighter' ? strokeWidth + 8 : strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = tool === 'highlighter' ? 0.35 : 1;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    },
    [color, strokeWidth, tool],
  );

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  // --- Borracha (object / stroke) aplicada a partir do snapshot pré-arrasto ---
  const applyErase = useCallback(
    (world: Point) => {
      const drag = dragRef.current;
      if (!drag || drag.mode !== 'erase') return;
      const base = preDragRef.current ?? elements;
      const r = (strokeWidth ?? 2) + 8;
      const eraser = { center: world, r };
      let changed = drag.eraseChanged ?? false;

      const next = base.flatMap((el) => {
        const near =
          el.x - r <= world.x &&
          world.x <= el.x + el.w + r &&
          el.y - r <= world.y &&
          world.y <= el.y + el.h + r;
        if (!near) return [el];
        if (eraserMode === 'object') {
          if (hitTest(el, world)) {
            changed = true;
            return [];
          }
          return [el];
        }
        // stroke: só afeta traços (shapes intocados, estilo Excalidraw).
        if (el.kind !== 'stroke' || !el.points || el.points.length < 2) {
          return [el];
        }
        const subs = splitStrokeAtEraser(el.points, eraser);
        if (subs.length === 0) {
          changed = true;
          return [];
        }
        if (subs.length === 1 && subs[0].length === el.points.length) {
          // não mudou significativamente
          return [el];
        }
        changed = true;
        return subs.map((pts) => {
          const xs = pts.map((p) => p.x);
          const ys = pts.map((p) => p.y);
          const x = Math.min(...xs);
          const y = Math.min(...ys);
          return {
            ...el,
            id: cryptoRandomId(),
            x,
            y,
            w: Math.max(...xs) - x,
            h: Math.max(...ys) - y,
            points: pts,
          } as BoardElement;
        });
      });
      drag.eraseChanged = changed;
      setElementsState(next);
    },
    [elements, eraserMode, strokeWidth],
  );

  // --- Pointer handlers ---
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (editingId) return;
      // Pen com ponta de borracha (button 5 em algumas mesas) → apaga.
      if (e.pointerType === 'pen' && e.button === 5) {
        setTool('eraser');
      }
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      // Dois ponteiros → pinch-zoom (cancela qualquer drag de desenho).
      if (pointersRef.current.size === 2) {
        const [a, b] = [...pointersRef.current.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        pinchRef.current = { dist, mid, zoom, pan };
        dragRef.current = { mode: 'pinch', startWorld: { x: 0, y: 0 }, startPan: pan, startEl: null };
        return;
      }

      viewportRef.current?.setPointerCapture?.(e.pointerId);
      const world = snapPoint(toWorld(e.clientX, e.clientY));

      // Pan: tool pan, espaço, ou botão do meio.
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
        const hit = [...elements].reverse().find((el) => hitTest(el, world));
        if (hit) {
          let group: Set<string>;
          if (e.shiftKey) {
            group = new Set(selectedIds);
            if (group.has(hit.id)) group.delete(hit.id);
            else group.add(hit.id);
          } else if (selectedIds.has(hit.id)) {
            group = new Set(selectedIds); // mantém multi-seleção, move o grupo
          } else {
            group = new Set([hit.id]);
          }
          setSelectedIds(group);
          preDragRef.current = elements;
          dragRef.current = {
            mode: 'move',
            startWorld: world,
            startPan: pan,
            startEl: null,
            startEls: elements.filter((el) => group.has(el.id)),
          };
        } else {
          if (!e.shiftKey) setSelectedIds(new Set());
          dragRef.current = {
            mode: 'marquee',
            startWorld: world,
            startPan: pan,
            startEl: null,
            marqueeRect: { x: world.x, y: world.y, w: 0, h: 0 },
          };
          setMarquee({ x: world.x, y: world.y, w: 0, h: 0 });
        }
        return;
      }

      if (tool === 'eraser') {
        preDragRef.current = elements;
        dragRef.current = {
          mode: 'erase',
          startWorld: world,
          startPan: pan,
          startEl: null,
          eraseIds: new Set(),
          eraseChanged: false,
        };
        applyErase(world);
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
          points: [{ x: world.x, y: world.y, p: pressureOf(e) }],
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
        setSelectedIds(new Set([id]));
        setEditingId(id);
        setEditingKind(tool === 'formula' ? 'formula' : 'text');
        return;
      }

      // shapes (rect/ellipse/diamond/line/arrow)
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
    [tool, elements, pan, toWorld, snapPoint, commit, color, strokeWidth, fontSize, editingId, selectedIds, applyErase], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      if (drag.mode === 'pinch') {
        const pin = pinchRef.current;
        if (!pin) return;
        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const [a, b] = [...pointersRef.current.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const newZoom = clamp(pin.zoom * (dist / (pin.dist || 1)), 0.2, 4);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const rect = viewportRef.current!.getBoundingClientRect();
        const local = { x: pin.mid.x - rect.left, y: pin.mid.y - rect.top };
        const wm = screenToWorld(local, pin.pan, pin.zoom);
        setPan({ x: mid.x - rect.left - wm.x * newZoom, y: mid.y - rect.top - wm.y * newZoom });
        setZoom(newZoom);
        return;
      }

      if (drag.mode === 'pan') {
        const dx = e.clientX - drag.startWorld.x;
        const dy = e.clientY - drag.startWorld.y;
        setPan({ x: drag.startPan.x + dx, y: drag.startPan.y + dy });
        return;
      }
      const world = snapPoint(toWorld(e.clientX, e.clientY));

      if (drag.mode === 'move' && drag.startEls) {
        const dx = world.x - drag.startWorld.x;
        const dy = world.y - drag.startWorld.y;
        if (dx !== 0 || dy !== 0) drag.moved = true;
        setElementsState((els) =>
          els.map((el) => {
            const snap = drag.startEls!.find((s) => s.id === el.id);
            return snap ? moveElement(snap, dx, dy) : el;
          }),
        );
        return;
      }
      if (drag.mode === 'resize' && drag.startEl && drag.handle) {
        const dx = world.x - drag.startWorld.x;
        const dy = world.y - drag.startWorld.y;
        if (dx !== 0 || dy !== 0) drag.moved = true;
        const startEl = drag.startEl;
        const handle = drag.handle;
        setElementsState((els) =>
          els.map((el) => (el.id === startEl.id ? resizeElement(startEl, handle, dx, dy) : el)),
        );
        return;
      }
      if (drag.mode === 'rotate' && drag.startEl) {
        const center = elementCenter(drag.startEl);
        const ang =
          (Math.atan2(world.y - center.y, world.x - center.x) * 180) / Math.PI + 90;
        const rot = Math.round(ang);
        drag.moved = true;
        setElementsState((els) =>
          els.map((el) => (el.id === drag.startEl!.id ? { ...el, rotation: rot } : el)),
        );
        return;
      }
      if (drag.mode === 'draw' && drag.startEl && drag.draftId) {
        let dx = world.x - drag.startWorld.x;
        let dy = world.y - drag.startWorld.y;
        if (e.shiftKey) {
          const k = drag.startEl.kind;
          if (k === 'line' || k === 'arrow') {
            const len = Math.hypot(dx, dy);
            const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
            dx = Math.cos(ang) * len;
            dy = Math.sin(ang) * len;
          } else {
            const m = Math.max(Math.abs(dx), Math.abs(dy));
            dx = Math.sign(dx || 1) * m;
            dy = Math.sign(dy || 1) * m;
          }
        }
        const w = dx;
        const h = dy;
        setElementsState((els) =>
          els.map((el) => (el.id === drag.draftId ? { ...el, w, h } : el)),
        );
        return;
      }
      if (drag.mode === 'stroke' && drag.points) {
        const ev = e.nativeEvent as PointerEvent;
        const events =
          typeof ev.getCoalescedEvents === 'function' ? ev.getCoalescedEvents() : [ev];
        for (const evp of events) {
          const w = snapPoint(toWorld(evp.clientX, evp.clientY));
          drag.points.push({ x: w.x, y: w.y, p: pressureOf(evp) });
        }
        drawStrokeCanvas(drag.points);
        return;
      }
      if (drag.mode === 'marquee') {
        const dx = world.x - drag.startWorld.x;
        const dy = world.y - drag.startWorld.y;
        drag.marqueeRect = { x: drag.startWorld.x, y: drag.startWorld.y, w: dx, h: dy };
        setMarquee({ x: drag.startWorld.x, y: drag.startWorld.y, w: dx, h: dy });
        return;
      }
      if (drag.mode === 'erase') {
        applyErase(world);
        return;
      }
    },
    [toWorld, snapPoint, drawStrokeCanvas, applyErase],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      const wasPinch = drag?.mode === 'pinch';
      pointersRef.current.delete(e.pointerId);
      dragRef.current = null;

      if (wasPinch) {
        // 2→1: não inicia um novo desenho com o dedo restante.
        if (pointersRef.current.size >= 1) {
          pinchRef.current = null;
          return;
        }
        pinchRef.current = null;
        return;
      }
      if (!drag) return;
      if (drag.mode === 'pan') return;

      if (drag.mode === 'move' || drag.mode === 'resize' || drag.mode === 'rotate') {
        if (drag.moved) {
          setElementsState((els) => {
            commitFrom(preDragRef.current ?? elements, els);
            return els;
          });
        }
        preDragRef.current = null;
        return;
      }
      if (drag.mode === 'marquee' && drag.marqueeRect) {
        const ids = marqueeSelect(elements, drag.marqueeRect);
        setSelectedIds((prev) => new Set([...prev, ...ids]));
        setMarquee(null);
        return;
      }
      if (drag.mode === 'erase') {
        setElementsState((els) => {
          if (drag.eraseChanged) commitFrom(preDragRef.current ?? elements, els);
          return els;
        });
        preDragRef.current = null;
        return;
      }
      if (drag.mode === 'draw') {
        setElementsState((els) => {
          const el = els.find((x) => x.id === drag.draftId);
          if (!el || (Math.abs(el.w) < 4 && Math.abs(el.h) < 4)) {
            const filtered = els.filter((x) => x.id !== drag.draftId);
            setElementsState(filtered);
            return filtered;
          }
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
    },
    [commit, commitFrom, elements, color, strokeWidth, tool, clearCanvas],
  );

  // --- Zoom por wheel (mantém ponto sob o cursor estável) ---
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const rect = viewportRef.current!.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const newZoom = clamp(zoom * factor, 0.2, 4);
      const wx = (cx - pan.x) / zoom;
      const wy = (cy - pan.y) / zoom;
      setPan({ x: cx - wx * newZoom, y: cy - wy * newZoom });
      setZoom(newZoom);
    },
    [zoom, pan],
  );

  // --- Handles de seleção (single) ---
  const startHandle = (e: React.PointerEvent, handle: ResizeHandle | 'rotate') => {
    e.stopPropagation();
    if (!selectedSingle) return;
    viewportRef.current?.setPointerCapture?.(e.pointerId);
    preDragRef.current = elements;
    dragRef.current = {
      mode: handle === 'rotate' ? 'rotate' : 'resize',
      startWorld: snapPoint(toWorld(e.clientX, e.clientY)),
      startPan: pan,
      startEl: selectedSingle,
      handle: handle === 'rotate' ? undefined : handle,
    };
  };

  // --- Imagem (centraliza no viewport visível) ---
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
        const center = vp.w
          ? toWorld(viewportRef.current!.getBoundingClientRect().left + vp.w / 2, viewportRef.current!.getBoundingClientRect().top + vp.h / 2)
          : { x: 0, y: 0 };
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
        setSelectedIds(new Set([el.id]));
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

  // Aplica estilo a todos os selecionados.
  const applyStyle = (patch: Partial<BoardElement>) => {
    if (selectedIds.size === 0) return;
    setElementsState((els) => {
      const next = els.map((el) => (selectedIds.has(el.id) ? { ...el, ...patch } : el));
      commitFrom(elements, next);
      return next;
    });
  };

  // Estilo de fundo (grade/pontos) em tela, sempre visível ao panar.
  // Usa --muted (texto secundário) com opacidade baixa em vez de --line,
  // pois --line pode ser quase branco no tema claro padrão e sumir no fundo.
  const bgStyle = useMemo(() => {
    const bg = board.background ?? 'grid';
    const cell = GRID * zoom;
    const px = pan.x % cell;
    const py = pan.y % cell;
    const dotColor = 'color-mix(in oklab, var(--muted) 28%, transparent)';
    const gridColor = 'color-mix(in oklab, var(--muted) 18%, transparent)';
    if (bg === 'blank') return { background: 'var(--bg)' } as React.CSSProperties;
    if (bg === 'dots') {
      return {
        backgroundColor: 'var(--bg)',
        backgroundImage: `radial-gradient(circle, ${dotColor} 1.5px, transparent 1.6px)`,
        backgroundSize: `${cell}px ${cell}px`,
        backgroundPosition: `${px}px ${py}px`,
      } as React.CSSProperties;
    }
    return {
      backgroundColor: 'var(--bg)',
      backgroundImage:
        `linear-gradient(to right, ${gridColor} 1px, transparent 1px), linear-gradient(to bottom, ${gridColor} 1px, transparent 1px)`,
      backgroundSize: `${cell}px ${cell}px`,
      backgroundPosition: `${px}px ${py}px`,
    } as React.CSSProperties;
  }, [board.background, zoom, pan]);

  const vb = `${worldBounds.x} ${worldBounds.y} ${worldBounds.w} ${worldBounds.h}`;

  return (
    <div className="absolute inset-0 flex flex-col">
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
                if (t !== 'select') setSelectedIds(new Set());
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
              onClick={() => {
                setColor(c);
                applyStyle({ color: c });
              }}
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
              onClick={() => {
                setStrokeWidth(w);
                applyStyle({ strokeWidth: w });
              }}
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
                onClick={() => {
                  setFontSize(s);
                  applyStyle({ fontSize: s });
                }}
                className="px-2 text-xs font-data"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {tool === 'eraser' && (
          <div className="seg">
            {(['object', 'stroke'] as const).map((m) => (
              <button
                key={m}
                type="button"
                data-active={eraserMode === m}
                onClick={() => setEraserMode(m)}
                className="px-2 text-xs"
              >
                {m === 'object' ? 'Objeto' : 'Traço'}
              </button>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            title="Desfazer (Ctrl+Z)"
            disabled={past.length === 0}
            onClick={undo}
            className="btn btn-ghost px-2 py-1 text-xs disabled:opacity-40"
          >
            ↶ Desfazer
          </button>
          <button
            type="button"
            title="Refazer (Ctrl+Shift+Z)"
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
        className="relative min-h-0 flex-1 overflow-hidden touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        style={{ ...bgStyle, cursor: tool === 'pan' ? 'grab' : tool === 'select' ? 'default' : 'crosshair' }}
      >
        <div
          className="absolute left-0 top-0"
          style={{
            transform: `translate(${pan.x + origin.x * zoom}px, ${pan.y + origin.y * zoom}px) scale(${zoom})`,
            transformOrigin: '0 0',
            width: worldBounds.w,
            height: worldBounds.h,
          }}
        >
          <BoardSVG
            board={{ ...board, elements }}
            width={worldBounds.w}
            height={worldBounds.h}
            viewBox={vb}
            renderFormula={renderFormula}
          />
          <canvas
            ref={canvasRef}
            width={worldBounds.w}
            height={worldBounds.h}
            className="pointer-events-none absolute left-0 top-0"
          />

          {/* Overlay de seleção + marquee (SVG com mesma viewBox do mundo) */}
          {((tool === 'select' && selected.length > 0) || marquee) && (
            <svg
              className="pointer-events-none absolute left-0 top-0"
              width={worldBounds.w}
              height={worldBounds.h}
              viewBox={vb}
            >
              {/* Marquee */}
              {marquee && (
                <rect
                  x={Math.min(marquee.x, marquee.x + marquee.w)}
                  y={Math.min(marquee.y, marquee.y + marquee.h)}
                  width={Math.abs(marquee.w)}
                  height={Math.abs(marquee.h)}
                  fill="var(--brand)"
                  fillOpacity={0.08}
                  stroke="var(--brand)"
                  strokeWidth={1.5 / zoom}
                  strokeDasharray={`${4 / zoom} ${3 / zoom}`}
                />
              )}
              {/* Grupo: caixa envoltória sem handles */}
              {selected.length > 1 && (() => {
                const g = groupBBox(selected);
                return (
                  <rect
                    x={g.x}
                    y={g.y}
                    width={g.w}
                    height={g.h}
                    fill="none"
                    stroke="var(--brand)"
                    strokeWidth={1.5 / zoom}
                    strokeDasharray={`${4 / zoom} ${3 / zoom}`}
                  />
                );
              })()}
            </svg>
          )}

          {/* Handles (single) — SVG próprio p/ capturar pointer */}
          {tool === 'select' && selectedSingle && !editingId && (
            <SelectionHandles
              el={selectedSingle}
              onHandle={startHandle}
              zoom={zoom}
              viewBox={vb}
              width={worldBounds.w}
              height={worldBounds.h}
            />
          )}

          {/* Editor de texto inline */}
          {editingId && editingKind === 'text' && selectedSingle && (
            <InlineTextEditor
              el={selectedSingle}
              origin={origin}
              onCommit={(v) => {
                commitEdit(selectedSingle.id, v);
                setEditingId(null);
                setEditingKind(null);
              }}
            />
          )}

          {/* Editor de fórmula */}
          {editingId && editingKind === 'formula' && selectedSingle && (
            <div
              className="absolute z-10 w-72 rounded-xl border border-line bg-surface p-3 shadow-[var(--shadow)]"
              style={{ left: selectedSingle.x - origin.x, top: selectedSingle.y - origin.y + selectedSingle.h + 6 }}
            >
              <MathField
                value={selectedSingle.latex ?? ''}
                onChange={(v) => {
                  setElementsState((els) =>
                    els.map((el) => (el.id === selectedSingle.id ? { ...el, latex: v } : el)),
                  );
                }}
                onCommit={() => {
                  setElementsState((els) => {
                    const next = els.map((el) =>
                      el.id === selectedSingle.id ? { ...el, latex: selectedSingle.latex ?? '' } : el,
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
  zoom,
  viewBox,
  width,
  height,
}: {
  el: BoardElement;
  onHandle: (e: React.PointerEvent, h: ResizeHandle | 'rotate') => void;
  zoom: number;
  viewBox: string;
  width: number;
  height: number;
}) {
  const rot = el.rotation ?? 0;
  const cx = el.x + el.w / 2;
  const cy = el.y + el.h / 2;
  const H = 9 / zoom;
  const sw = 1.5 / zoom;
  const dash = `${4 / zoom} ${3 / zoom}`;
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
    <svg
      className="absolute left-0 top-0"
      width={width}
      height={height}
      viewBox={viewBox}
      style={{ pointerEvents: 'none', overflow: 'visible' }}
    >
      <g transform={`rotate(${rot} ${cx} ${cy})`} style={{ pointerEvents: 'all' }}>
        <rect
          x={el.x}
          y={el.y}
          width={el.w}
          height={el.h}
          fill="none"
          stroke="var(--brand)"
          strokeWidth={sw}
          strokeDasharray={dash}
        />
        {handles.map(({ h, x, y }) => (
          <rect
            key={h}
            x={x - H / 2}
            y={y - H / 2}
            width={H}
            height={H}
            rx={1.5 / zoom}
            fill="var(--surface)"
            stroke="var(--brand)"
            strokeWidth={sw}
            onPointerDown={(e) => onHandle(e, h)}
            style={{ cursor: 'nwse-resize', pointerEvents: 'all' }}
          />
        ))}
        {/* handle de giro */}
        <line
          x1={cx}
          y1={el.y}
          x2={cx}
          y2={el.y - 26 / zoom}
          stroke="var(--brand)"
          strokeWidth={sw}
        />
        <circle
          cx={cx}
          cy={el.y - 30 / zoom}
          r={6 / zoom}
          fill="var(--surface)"
          stroke="var(--brand)"
          strokeWidth={sw}
          onPointerDown={(e) => onHandle(e, 'rotate')}
          style={{ cursor: 'grab', pointerEvents: 'all' }}
        />
      </g>
    </svg>
  );
}

// --- Editor de texto inline (textarea sobre o elemento) ---
function InlineTextEditor({
  el,
  origin,
  onCommit,
}: {
  el: BoardElement;
  origin: Point;
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
        left: el.x - origin.x,
        top: el.y - origin.y,
        width: Math.max(el.w, 80),
        height: Math.max(el.h, 28),
        fontSize: el.fontSize ?? 18,
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      }}
    />
  );
}