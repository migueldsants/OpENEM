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
  IconFit,
  IconFormula,
  IconHand,
  IconHighlighter,
  IconImage,
  IconLine,
  IconPen,
  IconRect,
  IconSticky,
  IconText,
  IconZoomIn,
  IconZoomOut,
  IconUndo,
  IconRedo,
} from '../components/icons';
import { cryptoRandomId } from './serialize';
import { BoardSVG } from './render';
import { Katex } from './Katex';
import { MathField } from './MathField';
import { measureText } from './text-measure';
import type { Board, BoardElement, Point } from './types';
import { GRID } from './types';
import {
  atBack,
  atFront,
  boardsBBox,
  bboxHit,
  bringForward,
  bringToFront,
  clamp,
  elementCenter,
  eraserHit,
  groupBBox,
  hitTest,
  marqueeSelect,
  moveElement,
  moveEndpoint,
  resizeElement,
  screenToWorld,
  sendBackward,
  sendToBack,
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
const WIDTH_MIN = 1;
const WIDTH_SLIDER_MAX = 32;
const WIDTH_MAX = 256;
const FONT_SIZES = [14, 18, 24, 32];
/** Formas que aceitam preenchimento (toggle "Preencher"). */
const SHAPE_KINDS: ReadonlySet<string> = new Set(['rect', 'ellipse', 'diamond']);
/** Elementos que aceitam mudança de fundo via paleta (formas + sticky). */
const FILLABLE: ReadonlySet<string> = new Set(['rect', 'ellipse', 'diamond', 'sticky']);
/** Estilos de ponta de linha/seta. */
const ARROW_TIPS = ['none', 'arrow', 'dot', 'bar'] as const;
type ArrowTip = (typeof ARROW_TIPS)[number];

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
  /** Snapshot mais recente do estado durante o arrasto (move/resize/rotate/draw/erase).
   * Computado a partir de `preDragRef.current` + snapshots — puro, síncrono —
   * para que o pointerup possa emitir sem ler dentro do updater do setElementsState
   * (o que dispararia o setState do pai durante o render). */
  committed?: BoardElement[];
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
  const [fillOn, setFillOn] = useState<boolean>(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [snapOn, setSnapOn] = useState(false);
  const [past, setPast] = useState<BoardElement[][]>([]);
  const [future, setFuture] = useState<BoardElement[][]>([]);
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; ids: string[] } | null>(null);

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
        setCtxMenu(null);
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

  // Duplica ids explícitos (menu de contexto) sem depender do `selected` do closure.
  function duplicateIds(ids: string[]) {
    const items = elements.filter((e) => ids.includes(e.id));
    if (items.length === 0) return;
    const pasted = items.map((el) => ({
      ...el,
      id: cryptoRandomId(),
      x: el.x + 20,
      y: el.y + 20,
      points: el.points?.map((p) => ({ x: p.x + 20, y: p.y + 20, ...(p.p != null ? { p: p.p } : {}) })),
    }));
    commitFrom(elements, [...elements, ...pasted]);
    setSelectedIds(new Set(pasted.map((p) => p.id)));
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

  // Sempre fresco: handlers de pointer (useCallback cu deps não incluem
  // `elements`) precisam do estado mais recente sem ler dentro do updater do
  // setElementsState — chamar commit/commitFrom dentro do updater dispara o
  // setState do pai (onChange/emit) na fase de render ("Cannot update a
  // component while rendering a different component").
  const elementsRef = useRef(elements);
  elementsRef.current = elements;

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

  // --- Borracha: apaga qualquer elemento que encosta e corta traços parcial ---
  // Sem toggle objeto/traço: a borracha apaga setas/linhas/formas/textos ao
  // encostar (via eraserHit, que usa o raio da borracha) e corta traços livres
  // onde o círculo cruza (splitStrokeAtEraser) — dá pra apagar pedaços de um
  // traço sem apagar o todo. O arrasto acumula: a base é o `committed` corrente,
  // não o snapshot pré-arrasto, então varrer apaga cada elemento encostado em
  // vez de apagar só o que está sob o cursor ao soltar.
  const applyErase = useCallback(
    (world: Point) => {
      const drag = dragRef.current;
      if (!drag || drag.mode !== 'erase') return;
      const base = drag.committed ?? preDragRef.current ?? elements;
      const r = (strokeWidth ?? 2) + 8;
      const eraser = { center: world, r };
      let changed = drag.eraseChanged ?? false;

      const next = base.flatMap((el) => {
        // Broad-phase: bbox local + folga. Para elementos rotacionados o bbox
        // real é maior que o local, então expande pela meia-diagonal.
        const pad = (el.rotation ?? 0) ? Math.hypot(el.w, el.h) / 2 + r : r;
        const near =
          el.x - pad <= world.x &&
          world.x <= el.x + el.w + pad &&
          el.y - pad <= world.y &&
          world.y <= el.y + el.h + pad;
        if (!near) return [el];

        // Traço livre: corta no círculo da borracha (apagado parcial).
        if (el.kind === 'stroke' && el.points && el.points.length >= 2) {
          const subs = splitStrokeAtEraser(el.points, eraser);
          if (subs.length === 0) {
            changed = true;
            return [];
          }
          if (subs.length === 1 && subs[0].length === el.points.length) {
            return [el]; // não mudou significativamente
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
        }

        // Demais elementos (seta/linha/forma/texto/sticky/imagem/fórmula):
        // apaga o elemento inteiro se a borracha encostar na coisa em si.
        if (eraserHit(el, world, r)) {
          changed = true;
          return [];
        }
        return [el];
      });
      drag.eraseChanged = changed;
      drag.committed = next;
      setElementsState(next);
    },
    [elements, strokeWidth],
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
        // Hit em camadas: primeiro a GEOMETRIA real (a coisa em si), depois o
        // bbox de um já-selecionado (arrastar forma vazada pelo interior) e só
        // então o bbox de qualquer elemento. Assim, clicar num traço que está
        // atrás de um retângulo vazado seleciona o traço (a geometria vence),
        // mas clicar no centro de um retângulo vazado isolado ainda o seleciona.
        const hit =
          [...elements].reverse().find((el) => hitTest(el, world)) ??
          (!e.shiftKey
            ? [...elements]
                .reverse()
                .find((el) => selectedIds.has(el.id) && bboxHit(el, world))
            : undefined) ??
          [...elements].reverse().find((el) => bboxHit(el, world));
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

      if (tool === 'text' || tool === 'sticky' || tool === 'formula') {
        const id = cryptoRandomId();
        const w = tool === 'text' ? 200 : tool === 'formula' ? 160 : 160;
        const h = tool === 'text' ? 40 : tool === 'formula' ? 48 : 100;
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
          latex: tool === 'formula' ? '' : undefined,
          fill: tool === 'sticky' ? '#fff7cc' : undefined,
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
        ...(fillOn && SHAPE_KINDS.has(tool) ? { fill: color } : {}),
        ...(tool === 'arrow'
          ? { arrowStart: 'none', arrowEnd: 'arrow' }
          : tool === 'line'
            ? { arrowStart: 'none', arrowEnd: 'none' }
            : {}),
      };
      preDragRef.current = elements; // snapshot pré-draw (sem o draft) p/ undo
      dragRef.current = {
        mode: 'draw',
        startWorld: world,
        startPan: pan,
        startEl: el,
        draftId: id,
      };
      setElementsState([...elements, el]); // preview sem histórico
    },
    [tool, elements, pan, toWorld, snapPoint, commit, color, strokeWidth, fontSize, fillOn, editingId, selectedIds, applyErase], // eslint-disable-line react-hooks/exhaustive-deps
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
        const base = preDragRef.current ?? elements;
        const next = base.map((el) => {
          const snap = drag.startEls!.find((s) => s.id === el.id);
          return snap ? moveElement(snap, dx, dy) : el;
        });
        drag.committed = next;
        setElementsState(next);
        return;
      }
      if (drag.mode === 'resize' && drag.startEl && drag.handle) {
        const startEl = drag.startEl;
        const handle = drag.handle;
        const base = preDragRef.current ?? elements;
        if (handle === 'ep-start' || handle === 'ep-end') {
          drag.moved = true;
          const next = base.map((el) => (el.id === startEl.id ? moveEndpoint(startEl, handle, world) : el));
          drag.committed = next;
          setElementsState(next);
          return;
        }
        const dx = world.x - drag.startWorld.x;
        const dy = world.y - drag.startWorld.y;
        if (dx !== 0 || dy !== 0) drag.moved = true;
        const next = base.map((el) => (el.id === startEl.id ? resizeElement(startEl, handle, dx, dy) : el));
        drag.committed = next;
        setElementsState(next);
        return;
      }
      if (drag.mode === 'rotate' && drag.startEl) {
        const center = elementCenter(drag.startEl);
        const ang =
          (Math.atan2(world.y - center.y, world.x - center.x) * 180) / Math.PI + 90;
        const rot = Math.round(ang);
        drag.moved = true;
        const base = preDragRef.current ?? elements;
        const next = base.map((el) => (el.id === drag.startEl!.id ? { ...el, rotation: rot } : el));
        drag.committed = next;
        setElementsState(next);
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
        // base = pré-draw (sem o draft) + draft com w/h atuais.
        const base = preDragRef.current ?? elements.filter((el) => el.id !== drag.draftId);
        const next = [...base, { ...drag.startEl, w, h }];
        drag.committed = next;
        setElementsState(next);
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
          const next = drag.committed ?? elementsRef.current;
          commitFrom(preDragRef.current ?? next, next);
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
        if (drag.eraseChanged) {
          const next = drag.committed ?? elementsRef.current;
          commitFrom(preDragRef.current ?? next, next);
        }
        preDragRef.current = null;
        return;
      }
      if (drag.mode === 'draw') {
        const committed = drag.committed ?? elementsRef.current;
        const el = committed.find((x) => x.id === drag.draftId);
        if (!el || (Math.abs(el.w) < 4 && Math.abs(el.h) < 4)) {
          // draft descartado: volta ao pré-draw, sem histórico.
          const filtered = (preDragRef.current ?? committed.filter((x) => x.id !== drag.draftId));
          setElementsState(filtered);
          preDragRef.current = null;
          return;
        }
        // Normaliza w/h p/ formas (rect/elipse/losango): o retângulo é o mesmo
        // independente do sentido do arrasto. MAS linha/seta têm DIREÇÃO —
        // (x,y) é o início (pointerdown) e (x+w,y+h) é o fim (onde soltou, onde
        // fica a ponta). Normalizar trocaria início↔fim e a seta "viraria para
        // o outro lado" ao arrastar pra esquerda. Mantém o sinal p/ line/arrow.
        const isLineLike = el.kind === 'line' || el.kind === 'arrow';
        const norm = committed.map((x) =>
          x.id === drag.draftId
            ? isLineLike
              ? x
              : {
                  ...x,
                  w: Math.abs(x.w),
                  h: Math.abs(x.h),
                  x: x.w < 0 ? x.x + x.w : x.x,
                  y: x.h < 0 ? x.y + x.h : x.y,
                }
            : x,
        );
        commitFrom(preDragRef.current ?? committed.filter((x) => x.id !== drag.draftId), norm);
        preDragRef.current = null;
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

  // --- Zoom ancorado no centro do viewport (botões da ilha de zoom) ---
  const zoomBy = useCallback(
    (factor: number) => {
      const rect = viewportRef.current?.getBoundingClientRect();
      const cx = rect ? rect.width / 2 : 0;
      const cy = rect ? rect.height / 2 : 0;
      const newZoom = clamp(zoom * factor, 0.2, 4);
      const wx = (cx - pan.x) / zoom;
      const wy = (cy - pan.y) / zoom;
      setPan({ x: cx - wx * newZoom, y: cy - wy * newZoom });
      setZoom(newZoom);
    },
    [zoom, pan],
  );

  // --- Ajusta zoom/pan para enquadar todo o conteúdo ---
  const fitToContent = useCallback(() => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || elements.length === 0) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }
    const b = boardsBBox(elements);
    if (b.w <= 0 || b.h <= 0) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }
    const pad = 80;
    const z = clamp(
      Math.min((rect.width - pad * 2) / b.w, (rect.height - pad * 2) / b.h),
      0.2,
      4,
    );
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const bx = b.x + b.w / 2;
    const by = b.y + b.h / 2;
    setZoom(z);
    setPan({ x: cx - bx * z, y: cy - by * z });
  }, [elements]);

  // --- Menu de contexto (botão-direito sobre um elemento) ---
  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      const world = toWorld(e.clientX, e.clientY);
      // Geometria real primeiro; senão cai no bbox (botão-direito no centro de
      // um retângulo vazado também abre o menu dele).
      const hit =
        [...elements].reverse().find((el) => hitTest(el, world)) ??
        [...elements].reverse().find((el) => bboxHit(el, world));
      if (!hit) {
        setCtxMenu(null);
        return;
      }
      e.preventDefault();
      const ids = selectedIds.has(hit.id) ? [...selectedIds] : [hit.id];
      if (!selectedIds.has(hit.id)) setSelectedIds(new Set([hit.id]));
      const rect = viewportRef.current!.getBoundingClientRect();
      setCtxMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top, ids });
    },
    [elements, selectedIds, toWorld],
  );

  // Duplo-clique reedita o conteúdo de texto/sticky/fórmula.
  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (tool !== 'select') return;
      const world = toWorld(e.clientX, e.clientY);
      const hit = [...elements]
        .reverse()
        .find(
          (el) =>
            (el.kind === 'text' || el.kind === 'sticky' || el.kind === 'formula') &&
            hitTest(el, world),
        );
      if (!hit) return;
      setSelectedIds(new Set([hit.id]));
      setEditingId(hit.id);
      setEditingKind(hit.kind === 'formula' ? 'formula' : 'text');
    },
    [tool, elements, toWorld],
  );

  const reorder = useCallback(
    (fn: (els: BoardElement[], ids: string[]) => BoardElement[]) => {
      if (!ctxMenu) return;
      const next = fn(elements, ctxMenu.ids);
      commitFrom(elements, next);
      setCtxMenu(null);
    },
    [ctxMenu, elements, commitFrom],
  );

  // Fecha o menu de contexto ao mudar zoom/pan (ele é posicionado em tela).
  useEffect(() => {
    setCtxMenu(null);
  }, [zoom, pan]);

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
    const v = value ?? '';
    const el0 = elements.find((e) => e.id === id);
    // Texto/fórmula vazios depois do commit viram fantasma invisível: o
    // <text> vazio e o renderFormula (latex vazio) não desenham nada, então
    // não dá pra reselecionar e o elemento fica preso no quadro. Descarta.
    // Sticky mantém (tem caixa visível mesmo sem texto).
    if (el0 && (el0.kind === 'text' || el0.kind === 'formula') && v.trim() === '') {
      const next = elements.filter((e) => e.id !== id);
      commit(next);
      setSelectedIds(new Set());
      return;
    }
    const next = elements.map((el) => {
      if (el.id !== id) return el;
      if (el.kind === 'formula') return { ...el, latex: v };
      if (el.kind === 'text') {
        // Casa o bbox com o texto desenhado (largura/altura medidas), senão a
        // caixa de seleção e os handles ficam soltos do texto. Sticky não:
        // a caixa é controlada pelo usuário (foreignObject com wrap).
        const m = measureText(v, el.fontSize ?? 18);
        return { ...el, text: v, w: m.w, h: m.h };
      }
      return { ...el, text: v };
    });
    // commit() chama setElementsState + emit (onChange do pai). NÃO pode estar
    // dentro do updater do setElementsState — o updater roda na fase de render
    // e dispararia o setState do pai durante o render do QuadroEditor (warning
    // "Cannot update a component while rendering a different component").
    commit(next);
  };

  const renderFormula = (el: BoardElement) =>
    el.latex ? <Katex latex={el.latex} /> : null;

  // Aplica estilo a todos os selecionados.
  const applyStyle = (patch: Partial<BoardElement>) => {
    if (selectedIds.size === 0) return;
    const next = elements.map((el) => (selectedIds.has(el.id) ? { ...el, ...patch } : el));
    commitFrom(elements, next);
  };

  // Aplica preenchimento aos selecionados que aceitam fundo (formas + sticky).
  const applyFill = (value: string | undefined) => {
    if (selectedIds.size === 0) return;
    const next = elements.map((el) =>
      selectedIds.has(el.id) && FILLABLE.has(el.kind) ? { ...el, fill: value } : el,
    );
    commitFrom(elements, next);
  };

  const toggleFill = () => {
    const next = !fillOn;
    setFillOn(next);
    applyFill(next ? color : undefined);
  };

  // Mostra o toggle "Preencher" quando a ferramenta ativa aceita fundo ou há
  // algum elemento que aceita na seleção.
  const showFill = FILLABLE.has(tool) || selected.some((e) => FILLABLE.has(e.kind));

  // Grade/pontos em tela (espaço de tela, não mundo): o tamanho da célula
  // escala com o zoom e a posição acompanha o pan (via módulo → infinito). Linhas
  // de 1px constantes — não tremelica ao zoomar. Única fonte no editor: o
  // pattern SVG do BoardSVG é desligado aqui (showBackground={false}) para não
  // duplicar. Usa --muted com opacidade baixa (visível nos dois temas).
  const bgStyle = useMemo(() => {
    const bg = board.background ?? 'grid';
    if (bg === 'blank') return { background: 'var(--bg)' } as React.CSSProperties;
    const cell = GRID * zoom;
    const px = pan.x % cell;
    const py = pan.y % cell;
    const dotColor = 'color-mix(in oklab, var(--muted) 28%, transparent)';
    const gridColor = 'color-mix(in oklab, var(--muted) 18%, transparent)';
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
              aria-label={label}
              data-active={tool === t}
              onClick={() => {
                setTool(t);
                if (t !== 'select') setSelectedIds(new Set());
                if (t === 'image') fileInputRef.current?.click();
              }}
              className="grid size-8 place-items-center"
            >
              <Icon width={18} height={18} weight={tool === t ? 'fill' : 'duotone'} aria-hidden />
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
              aria-label={`Cor ${c}`}
              onClick={() => {
                setColor(c);
                const patch: Partial<BoardElement> = { color: c };
                if (fillOn) patch.fill = c;
                applyStyle(patch);
              }}
              className={`size-5 rounded-full border ${color === c ? 'ring-2 ring-brand' : 'border-line'}`}
              style={{ background: c }}
            />
          ))}
        </div>

        {/* Preenchimento (só para formas) */}
        {showFill && (
          <div className="seg">
            <button
              type="button"
              title="Preencher forma com a cor atual"
              data-active={fillOn}
              onClick={toggleFill}
              className="px-2 text-xs"
            >
              Preencher
            </button>
          </div>
        )}

        {/* Pontas de linha/seta */}
        {selectedSingle &&
          (selectedSingle.kind === 'arrow' || selectedSingle.kind === 'line') && (
            <div className="flex items-center gap-1.5 px-1">
              <TipSelector
                label="Início"
                value={
                  selectedSingle.arrowStart ??
                  'none'
                }
                onChange={(v) => applyStyle({ arrowStart: v })}
              />
              <TipSelector
                label="Fim"
                value={
                  selectedSingle.arrowEnd ??
                  (selectedSingle.kind === 'arrow' ? 'arrow' : 'none')
                }
                onChange={(v) => applyStyle({ arrowEnd: v })}
              />
            </div>
          )}

        {/* Cor do texto (sticky) */}
        {selectedSingle?.kind === 'sticky' && (
          <div className="flex items-center gap-1 px-1">
            <span className="text-xs text-muted">Texto</span>
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                title="Cor do texto"
                aria-label={`Cor do texto ${c}`}
                onClick={() => applyStyle({ textColor: c })}
                className={`size-4 rounded-full border ${
                  (selectedSingle.textColor ?? '#5a4a1a') === c ? 'ring-2 ring-brand' : 'border-line'
                }`}
                style={{ background: c }}
              />
            ))}
          </div>
        )}

        {/* Espessura */}
        <div className="flex items-center gap-1.5">
          <input
            type="range"
            min={WIDTH_MIN}
            max={WIDTH_SLIDER_MAX}
            value={Math.min(strokeWidth, WIDTH_SLIDER_MAX)}
            onChange={(e) => {
              const w = Number(e.target.value);
              setStrokeWidth(w);
              applyStyle({ strokeWidth: w });
            }}
            className="h-5 w-16 cursor-pointer accent-brand"
            title={`Espessura ${strokeWidth}`}
          />
          <input
            type="number"
            min={WIDTH_MIN}
            max={WIDTH_MAX}
            value={strokeWidth}
            onChange={(e) => {
              const w = Math.min(WIDTH_MAX, Math.max(WIDTH_MIN, Number(e.target.value) || WIDTH_MIN));
              setStrokeWidth(w);
              applyStyle({ strokeWidth: w });
            }}
            className="w-12 rounded-lg border border-line bg-transparent px-1 py-0.5 text-center text-xs font-data tabular-nums outline-none focus:border-brand focus-visible:ring-2 focus-visible:ring-brand/40"
            title="Espessura do pincel"
          />
        </div>

        {(tool === 'text' || tool === 'sticky') && (
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

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            title="Desfazer (Ctrl+Z)"
            disabled={past.length === 0}
            onClick={undo}
            className="btn btn-ghost px-2 py-1 text-xs disabled:opacity-40"
          >
            <IconUndo width={14} height={14} />
            Desfazer
          </button>
          <button
            type="button"
            title="Refazer (Ctrl+Shift+Z)"
            disabled={future.length === 0}
            onClick={redo}
            className="btn btn-ghost px-2 py-1 text-xs disabled:opacity-40"
          >
            <IconRedo width={14} height={14} />
            Refazer
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
        onContextMenu={onContextMenu}
        onDoubleClick={onDoubleClick}
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
            showBackground={false}
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
                // Volta pra Selecionar: senão a ferramenta continua em Texto e o
                // próximo clique/arraste cria um novo texto em vez de mover o
                // recém-criado (que já está selecionado e é móvel).
                setTool('select');
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
                elId={selectedSingle.id}
                onChange={(v) => {
                  setElementsState((els) =>
                    els.map((el) => (el.id === selectedSingle.id ? { ...el, latex: v } : el)),
                  );
                }}
                onCommit={() => {
                  commitEdit(selectedSingle.id, selectedSingle.latex ?? '');
                  setEditingId(null);
                  setEditingKind(null);
                  setTool('select');
                }}
              />
            </div>
          )}
        </div>

        {/* Ilha de zoom (fixa em tela, canto inferior direito) */}
        <div
          className="absolute bottom-3 right-3 z-20 flex flex-col items-center gap-0.5 rounded-xl border border-line bg-surface/90 p-1 shadow-[var(--shadow)] backdrop-blur"
          onPointerDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            title="Aproximar"
            aria-label="Aproximar"
            onClick={() => zoomBy(1.2)}
            className="grid size-8 place-items-center rounded-lg text-fg hover:bg-surface-2"
          >
            <IconZoomIn width={18} height={18} aria-hidden />
          </button>
          <button
            type="button"
            title="Restaurar 100%"
            aria-label={`Restaurar zoom para 100% (atual ${Math.round(zoom * 100)}%)`}
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="px-1 py-0.5 text-center font-data text-xs leading-none text-muted hover:text-fg"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            title="Afastar"
            aria-label="Afastar"
            onClick={() => zoomBy(1 / 1.2)}
            className="grid size-8 place-items-center rounded-lg text-fg hover:bg-surface-2"
          >
            <IconZoomOut width={18} height={18} aria-hidden />
          </button>
          <div className="my-0.5 h-px w-6 bg-line" />
          <button
            type="button"
            title="Ajustar à tela"
            aria-label="Ajustar à tela"
            onClick={fitToContent}
            className="grid size-8 place-items-center rounded-lg text-fg hover:bg-surface-2"
          >
            <IconFit width={18} height={18} aria-hidden />
          </button>
        </div>

        {/* Menu de contexto (camadas + ações rápidas) */}
        {ctxMenu && (
          <>
            <div
              className="fixed inset-0 z-20"
              onClick={() => setCtxMenu(null)}
              onContextMenu={(e) => {
                e.preventDefault();
                setCtxMenu(null);
              }}
              aria-hidden
            />
            <div
              className="absolute z-30 w-48 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-[var(--shadow)]"
              style={{ left: ctxMenu.x, top: ctxMenu.y }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <CtxItem
                disabled={atFront(elements, ctxMenu.ids)}
                onClick={() => reorder(bringToFront)}
              >
                Trazer para frente
              </CtxItem>
              <CtxItem
                disabled={atFront(elements, ctxMenu.ids)}
                onClick={() => reorder(bringForward)}
              >
                Avançar
              </CtxItem>
              <CtxItem
                disabled={atBack(elements, ctxMenu.ids)}
                onClick={() => reorder(sendBackward)}
              >
                Recuar
              </CtxItem>
              <CtxItem
                disabled={atBack(elements, ctxMenu.ids)}
                onClick={() => reorder(sendToBack)}
              >
                Enviar para trás
              </CtxItem>
              <div className="my-1 h-px bg-line" />
              <CtxItem onClick={() => { duplicateIds(ctxMenu.ids); setCtxMenu(null); }}>
                Duplicar
              </CtxItem>
              <CtxItem
                danger
                onClick={() => {
                  commitFrom(
                    elements,
                    elements.filter((e) => !ctxMenu.ids.includes(e.id)),
                  );
                  setSelectedIds(new Set());
                  setCtxMenu(null);
                }}
              >
                Excluir
              </CtxItem>
            </div>
          </>
        )}

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
  const isLine = el.kind === 'line' || el.kind === 'arrow';
  const handles: { h: ResizeHandle; x: number; y: number }[] = isLine
    ? [
        { h: 'ep-start', x: el.x, y: el.y },
        { h: 'ep-end', x: el.x + el.w, y: el.y + el.h },
      ]
    : [
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
        {/* handle de giro (não faz sentido para linha/seta) */}
        {!isLine && (
          <>
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
          </>
        )}
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
  // Foca depois que o ciclo de pointer/click do criador assenta: focar
  // sincronamente durante o pointerdown (com pointer capture no viewport)
  // faz o browser reverter o foco para <body> no click seguinte, disparando
  // onBlur → commit → desmonta o editor antes da edição. setTimeout(0) só
  // dispara depois de pointerup/click, então o foco "gruda".
  useEffect(() => {
    const t = setTimeout(() => {
      ref.current?.focus();
      ref.current?.select();
    }, 0);
    return () => clearTimeout(t);
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

// --- Item do menu de contexto ---
function CtxItem({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center px-3 py-1.5 text-left text-sm transition-colors hover:bg-surface-2 disabled:opacity-40 disabled:hover:bg-transparent ${
        danger ? 'text-danger' : 'text-fg'
      }`}
    >
      {children}
    </button>
  );
}

// --- Seletor de ponta de linha/seta ---
// Prévia desenhada em SVG: mostra a ponta de verdade e não depende da fonte
// (os glifos anteriores viravam emoji colorido em alguns sistemas).
const TIP_LABEL: Record<ArrowTip, string> = {
  none: 'reta',
  arrow: 'seta',
  dot: 'bolinha',
  bar: 'barra',
};
function TipGlyph({ tip }: { tip: ArrowTip }) {
  return (
    <svg width={20} height={12} viewBox="0 0 20 12" aria-hidden focusable="false">
      <line
        x1={2}
        y1={6}
        x2={tip === 'none' ? 18 : 13}
        y2={6}
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      {tip === 'arrow' && (
        <path d="M12 2.5 L18.5 6 L12 9.5 Z" fill="currentColor" />
      )}
      {tip === 'dot' && <circle cx={15.5} cy={6} r={3} fill="currentColor" />}
      {tip === 'bar' && (
        <rect x={14} y={2} width={3} height={8} rx={0.5} fill="currentColor" />
      )}
    </svg>
  );
}
function TipSelector({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ArrowTip;
  onChange: (v: ArrowTip) => void;
}) {
  return (
    <div className="seg">
      <span className="px-1 text-xs text-muted">{label}</span>
      {ARROW_TIPS.map((t) => (
        <button
          key={t}
          type="button"
          title={TIP_LABEL[t]}
          aria-label={`Ponta ${label}: ${TIP_LABEL[t]}`}
          data-active={value === t}
          onClick={() => onChange(t)}
          className="grid place-items-center px-1.5"
        >
          <TipGlyph tip={t} />
        </button>
      ))}
    </div>
  );
}