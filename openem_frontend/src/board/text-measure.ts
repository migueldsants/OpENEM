// Mede texto para o quadro: largura/altura de um <text> SVG com a fonte padrão,
// usado para casar a caixa de seleção (bbox) com o texto realmente desenhado
// (issue #32). Canvas 2D measureText é uma boa aproximação do render SVG (mesma
// font stack). Em ambientes sem canvas (jsdom) cai numa estimativa por caractere.
//
// A altura segue a mesma métrica do render: lineH = fontSize * 1.2, e o render
// usa dominant-baseline=hanging, então el.y é o TOPO do texto — o bbox começa
// em el.y e tem altura lineH * nº de linhas.

const FONT_STACK = 'ui-sans-serif, system-ui, sans-serif';
let ctx: CanvasRenderingContext2D | null = null;

function getCtx(): CanvasRenderingContext2D | null {
  if (ctx) return ctx;
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  ctx = c.getContext('2d');
  return ctx;
}

/** Mede um texto (com quebras de linha `\n`) na fonte/ tamanho dados. */
export function measureText(text: string, fontSize: number): { w: number; h: number } {
  const fs = fontSize > 0 ? fontSize : 18;
  const lineSpacing = fs * 1.2; // dy entre tspans (render/export)
  const lines = (text ?? '').split('\n');
  const c = getCtx();
  if (!c) {
    // jsdom/fallback: ~0.6em por caractere (largura média de fonte sans).
    const w = Math.max(...lines.map((l) => l.length), 1) * fs * 0.6;
    return { w: Math.max(w, 8), h: Math.ceil(lineSpacing * lines.length) };
  }
  c.font = `${fs}px ${FONT_STACK}`;
  // Altura real da em-box da fonte (ascent+descent) — casa com o render SVG
  // (dominant-baseline=text-before-edge alinha o topo da em-box com y).
  const m = c.measureText('Áj');
  const emBox =
    (m.fontBoundingBoxAscent ?? 0) + (m.fontBoundingBoxDescent ?? 0) || fs * 1.33;
  let maxW = 0;
  for (const l of lines) maxW = Math.max(maxW, c.measureText(l.length ? l : ' ').width);
  // 1ª linha ocupa a em-box; linhas seguintes somam o espaçamento (dy).
  const h = (lines.length - 1) * lineSpacing + emBox;
  return { w: Math.ceil(maxW), h: Math.ceil(h) };
}