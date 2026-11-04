/**
 * Caderno de fórmulas em PDF: a "cola" do OpENEM para imprimir.
 *
 * Irmão do caderno de prova (`simulado-pdf.ts`), com duas diferenças que dão
 * o acabamento:
 *   - fórmula é desenhada como vetor a partir do LaTeX (`math-svg.ts`), e não
 *     como texto: fração, raiz e expoente saem como num livro;
 *   - a fonte é a Inter embutida, e não a Helvetica do PDF, que não tem Δ, ≈,
 *     ≠ nem ↔ (e as explicações usam todos).
 *
 * Ordem: capa, sumário, e as fórmulas agrupadas por matéria e, dentro dela,
 * por assunto: cada assunto tem o próprio título e a própria grade de
 * cartões (expressão em destaque, explicação e legenda de cada símbolo). Os
 * dois cartões de cada linha têm a mesma altura e as faixas internas
 * alinhadas (título, fórmula, explicação, legenda), e nenhum cartão é
 * partido entre páginas.
 */

import { dirname, join } from 'node:path';
import PDFDocument from 'pdfkit';
import SVGtoPDF from 'svg-to-pdfkit';
import { MathSvg, texToSvg } from './math-svg';
import { contrastInk, PdfTheme, resolveTheme, themeWithBrand } from './themes';
import { loadWoffAsSfnt } from './woff-to-sfnt';

export interface FormulaPdfSymbol {
  symbol: string;
  meaning: string;
  unit: string | null;
}

export interface FormulaPdfItem {
  title: string;
  latex: string;
  description: string | null;
  subjectName: string;
  topicName: string | null;
  symbols: FormulaPdfSymbol[];
}

export interface FormulasPdfOptions {
  title: string;
  /** Chave do tema de cor do app (mesmos temas do caderno de prova). */
  theme?: string | null;
  /** Cor livre em hex, no lugar da cor do tema. */
  brandColor?: string | null;
  cover?: boolean;
  toc?: boolean;
  /** Legenda dos símbolos de cada fórmula. */
  legend?: boolean;
  /** Explicação curta abaixo da fórmula. */
  descriptions?: boolean;
  twoColumns?: boolean;
  /** Nome do aluno na capa; vazio imprime a linha para preencher à mão. */
  studentName?: string | null;
  /** Injetável para o teste não depender da data de hoje. */
  now?: Date;
}

type Doc = PDFKit.PDFDocument;

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = { top: 62, bottom: 58, left: 46, right: 46 };
const CONTENT_W = PAGE.width - MARGIN.left - MARGIN.right;
const GUTTER = 16;
const CARD_GAP = 10;
const SECTION_GAP = 18;

const FONT = {
  regular: 'Inter',
  medium: 'Inter-Medium',
  semibold: 'Inter-SemiBold',
  bold: 'Inter-Bold',
  extrabold: 'Inter-ExtraBold',
};

/** Pontos por "ex" do MathJax: a fórmula do cartão e o símbolo da legenda. */
const EX_FORMULA = 7.2;
const EX_SYMBOL = 5.1;
/** Corpo do texto da legenda (o símbolo se alinha à linha de base dele). */
const LEGEND_SIZE = 8.3;

/** Mesmas dicas do cartão de estudo, curtas o bastante para a capa. */
const DICAS = [
  'Leia a legenda antes de decorar: saber o que cada letra significa é metade da questão.',
  'Marque com caneta as fórmulas que você ainda esquece e revise só essas.',
  'Na prova, anote no rascunho as fórmulas do assunto antes de começar a conta.',
];

const SOBRE =
  'O OpENEM é uma plataforma livre e gratuita de preparação para o ENEM: ' +
  'questões oficiais, simulados, revisão espaçada e flashcards. ' +
  'Código aberto (AGPL-3.0), sem anúncios.';

// ------------------------------------------------------------ utilidades

/** Inter vem do pacote `inter-ui` (OFL-1.1): nada de binário no repositório. */
function registerFonts(doc: Doc): void {
  const pasta = join(
    dirname(require.resolve('inter-ui/package.json')),
    'Inter (web)',
  );
  // WOFF (e não WOFF2): o fontkit do PDFKit quebra ao recortar a Inter a
  // partir do WOFF2. E já convertido para TTF (`woff-to-sfnt.ts`): lido como
  // WOFF, o fontkit descomprimia as tabelas a cada palavra medida.
  const arquivo: Record<string, string> = {
    [FONT.regular]: 'Inter-Regular.woff',
    [FONT.medium]: 'Inter-Medium.woff',
    [FONT.semibold]: 'Inter-SemiBold.woff',
    [FONT.bold]: 'Inter-Bold.woff',
    [FONT.extrabold]: 'Inter-ExtraBold.woff',
  };
  for (const [nome, file] of Object.entries(arquivo)) {
    doc.registerFont(nome, loadWoffAsSfnt(join(pasta, file)));
  }
}

/** Mistura duas cores hex (0 = a, 1 = b). */
function mix(a: string, b: string, t: number): string {
  const rgb = (h: string) =>
    [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [rgb(a), rgb(b)];
  return `#${x
    .map((v, i) =>
      Math.round(v + (y[i] - v) * t)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

function drawMath(
  doc: Doc,
  m: MathSvg,
  x: number,
  y: number,
  exPt: number,
  color: string,
): void {
  const w = m.widthEx * exPt;
  const h = m.heightEx * exPt;
  // O svg-to-pdfkit converte o "ex" do SVG por conta própria (≈ 4/3 maior) e
  // ignora a largura pedida: a medida vai reescrita em pontos no próprio SVG.
  const svg = m.svg
    .replace(/currentColor/g, color)
    .replace(/ width="[\d.]+ex"/, ` width="${w}"`)
    .replace(/ height="[\d.]+ex"/, ` height="${h}"`);
  SVGtoPDF(doc, svg, x, y, SVG_TO_PDF_OPTIONS);
}

/** PNG transparente de 1×1, em data URI. */
const PNG_VAZIO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/**
 * Opções do `svg-to-pdfkit`. Sem `imageCallback`, ele resolve o endereço de
 * uma imagem do SVG por conta própria; aqui toda imagem vira um pixel
 * transparente (o `texToSvg` já tira as imagens; isto é a segunda trava).
 */
export const SVG_TO_PDF_OPTIONS = {
  assumePt: true,
  imageCallback: (): string => PNG_VAZIO,
};

/**
 * Onde desenhar o SVG para a linha de base dele cair na linha de base de um
 * texto em `fontSize` que começa em `textY`.
 */
function baselineY(m: MathSvg, exPt: number, textY: number, fontSize: number) {
  return textY + fontSize * 0.78 - (m.heightEx - m.depthEx) * exPt;
}

/** Escala que faz a fórmula caber na largura, sem passar do tamanho base. */
function fitScale(m: MathSvg, base: number, maxWidth: number): number {
  return m.widthEx * base > maxWidth ? maxWidth / m.widthEx : base;
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

/** Marca do OpENEM: quadrado com "Op" e "EM", como o ícone do app. */
function drawMark(
  doc: Doc,
  x: number,
  y: number,
  size: number,
  theme: PdfTheme,
) {
  doc.save();
  doc.roundedRect(x, y, size, size, size * 0.24).fill('#0f172a');
  doc
    .font(FONT.extrabold)
    .fontSize(size * 0.36)
    .fillColor('#ffffff')
    .text('Op', x, y + size * 0.16, {
      width: size,
      align: 'center',
      lineBreak: false,
    });
  doc
    .font(FONT.extrabold)
    .fontSize(size * 0.24)
    .fillColor(theme.brand)
    .text('EM', x, y + size * 0.57, {
      width: size,
      align: 'center',
      lineBreak: false,
    });
  doc.restore();
}

// ------------------------------------------------------------ cartão

/**
 * Altura de cada faixa do cartão. Numa linha de dois cartões, cada faixa
 * fica com a altura da maior das duas: título com título, fórmula com
 * fórmula, legenda com legenda. É o que alinha a grade.
 */
interface Faixas {
  title: number;
  strip: number;
  desc: number;
  legend: number;
}

interface CardPlan {
  faixas: Faixas;
  draw: (x: number, y: number, faixas: Faixas) => void;
}

const CARD = {
  pad: 12,
  accent: 3,
  radius: 9,
  /** Espaço entre as faixas. */
  gap: 8,
  stripPad: 10,
  /** Faixa mínima da fórmula: "Q = mv" e uma fração ficam do mesmo tamanho. */
  stripMin: 56,
  /** Coluna do símbolo na legenda, igual em todos os cartões. */
  symCol: 46,
  titleSize: 10.4,
  descSize: 8.5,
};

function alturaDoCartao(f: Faixas): number {
  return (
    CARD.pad +
    f.title +
    CARD.gap +
    f.strip +
    (f.desc ? CARD.gap + f.desc : 0) +
    (f.legend ? CARD.gap + 2 + f.legend : 0) +
    CARD.pad
  );
}

function maxFaixas(a: Faixas, b: Faixas): Faixas {
  return {
    title: Math.max(a.title, b.title),
    strip: Math.max(a.strip, b.strip),
    desc: Math.max(a.desc, b.desc),
    legend: Math.max(a.legend, b.legend),
  };
}

/**
 * Mede o cartão de uma fórmula e devolve como desenhá-lo com as faixas da
 * linha (que podem ser maiores que as dele).
 */
function planCard(
  doc: Doc,
  f: FormulaPdfItem,
  width: number,
  theme: PdfTheme,
  opts: FormulasPdfOptions,
): CardPlan {
  const x0 = CARD.pad + CARD.accent;
  const inner = width - x0 - CARD.pad;

  doc.font(FONT.semibold).fontSize(CARD.titleSize);
  const titleH = doc.heightOfString(f.title, { width: inner });

  const math = texToSvg(f.latex, true);
  const scale = fitScale(math, EX_FORMULA, inner - CARD.stripPad * 2);
  const mathW = math.widthEx * scale;
  const mathH = math.heightEx * scale;
  const stripH = Math.max(CARD.stripMin, mathH + CARD.stripPad * 2);

  const desc = opts.descriptions !== false ? f.description?.trim() : '';
  doc.font(FONT.regular).fontSize(CARD.descSize);
  const descH = desc
    ? doc.heightOfString(desc, { width: inner, lineGap: 1.6 })
    : 0;

  // Legenda: símbolo (vetor) numa coluna fixa, significado e unidade ao lado.
  const textW = inner - CARD.symCol - 8;
  const linhas = (opts.legend !== false ? f.symbols : []).map((s) => {
    const m = texToSvg(s.symbol, false);
    const sc = fitScale(m, EX_SYMBOL, CARD.symCol);
    doc.font(FONT.regular).fontSize(LEGEND_SIZE);
    const texto = s.unit ? `${s.meaning} (${s.unit})` : s.meaning;
    const th = doc.heightOfString(texto, { width: textW, lineGap: 1.2 });
    // Símbolo alinhado à 1ª linha do texto: o que sobra acima/abaixo dele
    // (V_f desce, \Delta sobe) entra na altura da linha.
    const topo = Math.min(0, baselineY(m, sc, 0, LEGEND_SIZE));
    const fundo = Math.max(
      th,
      baselineY(m, sc, 0, LEGEND_SIZE) + m.heightEx * sc,
    );
    return { s, m, sc, topo, h: fundo - topo };
  });
  const LEGEND_LABEL = 15;
  const legendH = linhas.length
    ? LEGEND_LABEL + linhas.reduce((acc, l) => acc + l.h + 5, 0) - 5
    : 0;

  return {
    faixas: { title: titleH, strip: stripH, desc: descH, legend: legendH },
    draw: (x, y, faixas) => {
      const height = alturaDoCartao(faixas);
      // Cartão: branco, filete fino e uma barra da cor da marca à esquerda.
      doc.save();
      doc.roundedRect(x, y, width, height, CARD.radius).clip();
      doc.rect(x, y, width, height).fill('#ffffff');
      doc.rect(x, y, CARD.accent, height).fill(theme.brand);
      doc.restore();
      doc
        .roundedRect(x, y, width, height, CARD.radius)
        .lineWidth(0.7)
        .stroke(theme.line);

      let cy = y + CARD.pad;
      doc
        .font(FONT.semibold)
        .fontSize(CARD.titleSize)
        .fillColor(theme.fg)
        .text(f.title, x + x0, cy, { width: inner });
      cy += faixas.title + CARD.gap;

      // Faixa da fórmula: altura da linha, fórmula no centro dela.
      doc
        .roundedRect(x + x0, cy, inner, faixas.strip, 6)
        .fill(mix('#ffffff', theme.brand, 0.06));
      drawMath(
        doc,
        math,
        x + x0 + (inner - mathW) / 2,
        cy + (faixas.strip - mathH) / 2,
        scale,
        theme.fg,
      );
      cy += faixas.strip;

      if (faixas.desc) {
        cy += CARD.gap;
        if (desc) {
          doc
            .font(FONT.regular)
            .fontSize(CARD.descSize)
            .fillColor(theme.muted)
            .text(desc, x + x0, cy, { width: inner, lineGap: 1.6 });
        }
        cy += faixas.desc;
      }

      if (linhas.length) {
        cy += CARD.gap + 2;
        doc
          .font(FONT.bold)
          .fontSize(6.8)
          .fillColor(theme.brand)
          .text('O QUE CADA SÍMBOLO SIGNIFICA', x + x0, cy, {
            characterSpacing: 0.7,
            lineBreak: false,
          });
        cy += LEGEND_LABEL;
        for (const l of linhas) {
          const ty = cy - l.topo;
          drawMath(
            doc,
            l.m,
            x + x0,
            baselineY(l.m, l.sc, ty, LEGEND_SIZE),
            l.sc,
            theme.fg,
          );
          doc.font(FONT.regular).fontSize(LEGEND_SIZE).fillColor(theme.fg);
          doc.text(l.s.meaning, x + x0 + CARD.symCol + 8, ty, {
            width: textW,
            lineGap: 1.2,
            continued: !!l.s.unit,
          });
          if (l.s.unit) {
            doc.fillColor(theme.muted).text(` (${l.s.unit})`, {
              lineGap: 1.2,
            });
          }
          cy += l.h + 5;
        }
      }
    },
  };
}

/** Uma linha da grade: um ou dois cartões com as mesmas faixas. */
interface Linha {
  cards: CardPlan[];
  faixas: Faixas;
  height: number;
}

/** Agrupa os cartões de um assunto em linhas de `colunas` cartões. */
export function rows<T>(items: T[], colunas: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += colunas) {
    out.push(items.slice(i, i + colunas));
  }
  return out;
}

function planLinha(cards: CardPlan[]): Linha {
  const faixas = cards.map((c) => c.faixas).reduce(maxFaixas);
  return { cards, faixas, height: alturaDoCartao(faixas) };
}

// ------------------------------------------------------------ capa

interface Grupo {
  subject: string;
  topics: { name: string; items: FormulaPdfItem[] }[];
  count: number;
}

/** Matéria › assunto, na ordem em que as fórmulas chegaram. */
export function groupFormulas(items: FormulaPdfItem[]): Grupo[] {
  const grupos: Grupo[] = [];
  for (const f of items) {
    let g = grupos.find((x) => x.subject === f.subjectName);
    if (!g) {
      g = { subject: f.subjectName, topics: [], count: 0 };
      grupos.push(g);
    }
    const nome = f.topicName ?? 'Outras fórmulas';
    let t = g.topics.find((x) => x.name === nome);
    if (!t) {
      t = { name: nome, items: [] };
      g.topics.push(t);
    }
    t.items.push(f);
    g.count++;
  }
  return grupos;
}

function drawCover(
  doc: Doc,
  grupos: Grupo[],
  items: FormulaPdfItem[],
  theme: PdfTheme,
  opts: FormulasPdfOptions,
): void {
  const ink = contrastInk(theme.brand);
  const bandH = 372;

  const grad = doc.linearGradient(0, 0, PAGE.width, bandH);
  grad.stop(0, theme.brand).stop(1, theme.brand2);
  doc.rect(0, 0, PAGE.width, bandH).fill(grad);

  // Decoração: fórmulas da própria seleção, grandes e quase transparentes
  // (cor misturada ao fundo, que imprime melhor que opacidade).
  const fantasma = mix(theme.brand2, ink, 0.16);
  doc.save();
  doc.rect(0, 0, PAGE.width, bandH).clip();
  const decor = items.slice(0, 4);
  decor.forEach((f, i) => {
    const m = texToSvg(f.latex, true);
    if (m.error) return;
    const sc = Math.min(13, 300 / Math.max(1, m.widthEx));
    drawMath(
      doc,
      m,
      PAGE.width - 40 - m.widthEx * sc,
      40 + i * 82,
      sc,
      fantasma,
    );
  });
  doc.restore();

  // Marca e rótulo.
  drawMark(doc, MARGIN.left, 46, 30, theme);
  doc
    .font(FONT.extrabold)
    .fontSize(15)
    .fillColor(ink)
    .text('OpENEM', MARGIN.left + 40, 53, { lineBreak: false });

  doc
    .font(FONT.bold)
    .fontSize(8.5)
    .fillColor(ink)
    .opacity(0.85)
    .text('CADERNO DE FÓRMULAS', MARGIN.left, 168, {
      characterSpacing: 1.6,
      lineBreak: false,
    })
    .opacity(1);
  doc
    .font(FONT.extrabold)
    .fontSize(34)
    .fillColor(ink)
    .text(opts.title, MARGIN.left, 186, { width: 400, lineGap: -2 });

  const materias = grupos.map((g) => g.subject);
  const resumo =
    materias.length <= 3
      ? materias.join(', ').replace(/, ([^,]*)$/, ' e $1')
      : plural(materias.length, 'matéria', 'matérias');
  doc
    .font(FONT.medium)
    .fontSize(12)
    .fillColor(ink)
    .opacity(0.9)
    .text(
      `${plural(items.length, 'fórmula', 'fórmulas')} · ${resumo}`,
      MARGIN.left,
      doc.y + 10,
      { width: 400 },
    )
    .opacity(1);

  // O que tem aqui: matérias com a contagem, em duas colunas.
  let y = bandH + 36;
  doc
    .font(FONT.bold)
    .fontSize(12)
    .fillColor(theme.fg)
    .text('O que tem neste caderno', MARGIN.left, y);
  y += 24;
  const colW = (CONTENT_W - GUTTER) / 2;
  grupos.forEach((g, i) => {
    const cx = MARGIN.left + (i % 2) * (colW + GUTTER);
    const cy = y + Math.floor(i / 2) * 42;
    doc
      .roundedRect(cx, cy, colW, 34, 8)
      .fill(mix('#ffffff', theme.brand, 0.06));
    doc.circle(cx + 14, cy + 17, 4).fill(theme.brand);
    doc
      .font(FONT.semibold)
      .fontSize(10.5)
      .fillColor(theme.fg)
      .text(g.subject, cx + 26, cy + 11, {
        width: colW - 110,
        lineBreak: false,
        ellipsis: true,
      });
    const tag = `${plural(g.count, 'fórmula', 'fórmulas')} · ${plural(g.topics.length, 'assunto', 'assuntos')}`;
    doc.font(FONT.regular).fontSize(8.5).fillColor(theme.muted);
    doc.text(tag, cx + colW - 12 - doc.widthOfString(tag), cy + 12.5, {
      lineBreak: false,
    });
  });
  y += Math.ceil(grupos.length / 2) * 42 + 18;

  // Como usar: três dicas numeradas.
  if (y < PAGE.height - 250) {
    doc
      .font(FONT.bold)
      .fontSize(12)
      .fillColor(theme.fg)
      .text('Como tirar proveito', MARGIN.left, y);
    y += 22;
    DICAS.forEach((d, i) => {
      doc.circle(MARGIN.left + 9, y + 7, 9).fill(theme.brand);
      doc
        .font(FONT.bold)
        .fontSize(9)
        .fillColor(contrastInk(theme.brand))
        .text(String(i + 1), MARGIN.left, y + 2.5, {
          width: 18,
          align: 'center',
          lineBreak: false,
        });
      doc
        .font(FONT.regular)
        .fontSize(9.5)
        .fillColor(theme.fg)
        .text(d, MARGIN.left + 28, y + 1, {
          width: CONTENT_W - 28,
          lineGap: 1.5,
        });
      y = doc.y + 9;
    });
  }

  // Rodapé: dono do caderno, data e o que é o OpENEM.
  const base = PAGE.height - 118;
  doc
    .moveTo(MARGIN.left, base)
    .lineTo(PAGE.width - MARGIN.right, base)
    .lineWidth(0.7)
    .stroke(theme.line);
  doc
    .font(FONT.semibold)
    .fontSize(9)
    .fillColor(theme.muted)
    .text('Nome', MARGIN.left, base + 16);
  const nome = opts.studentName?.trim();
  if (nome) {
    doc
      .font(FONT.bold)
      .fontSize(12)
      .fillColor(theme.fg)
      .text(nome, MARGIN.left, base + 30, {
        width: 300,
        lineBreak: false,
        ellipsis: true,
      });
  } else {
    doc
      .moveTo(MARGIN.left, base + 46)
      .lineTo(MARGIN.left + 280, base + 46)
      .lineWidth(0.8)
      .stroke(theme.line);
  }
  const data = formatDate(opts.now ?? new Date());
  doc.font(FONT.semibold).fontSize(9).fillColor(theme.muted);
  doc.text('Gerado em', PAGE.width - MARGIN.right - 150, base + 16, {
    width: 150,
    align: 'right',
  });
  doc.font(FONT.medium).fontSize(10).fillColor(theme.fg);
  doc.text(data, PAGE.width - MARGIN.right - 150, base + 31, {
    width: 150,
    align: 'right',
  });
  doc
    .font(FONT.regular)
    .fontSize(7.8)
    .fillColor(theme.muted)
    .text(SOBRE, MARGIN.left, base + 66, { width: CONTENT_W, lineGap: 1.3 });
}

// ------------------------------------------------------------ sumário

interface Entrada {
  label: string;
  page: number;
  level: 0 | 1;
  count: number;
}

function drawToc(
  doc: Doc,
  entradas: Entrada[],
  theme: PdfTheme,
  offset: number,
) {
  let y = MARGIN.top + 6;
  doc
    .font(FONT.extrabold)
    .fontSize(24)
    .fillColor(theme.fg)
    .text('Sumário', MARGIN.left, y);
  y = doc.y + 4;
  doc
    .font(FONT.regular)
    .fontSize(9.5)
    .fillColor(theme.muted)
    .text('Matérias e assuntos, com a página de cada um.', MARGIN.left, y);
  y = doc.y + 22;

  for (const e of entradas) {
    const limite = PAGE.height - MARGIN.bottom - 20;
    if (y > limite) break; // um sumário de uma página cobre o catálogo inteiro
    const indent = e.level === 0 ? 0 : 16;
    const fonte = e.level === 0 ? FONT.bold : FONT.regular;
    const tamanho = e.level === 0 ? 11 : 9.5;
    if (e.level === 0 && y > MARGIN.top + 80) y += 8;
    const num = String(e.page + offset);
    doc.font(fonte).fontSize(tamanho);
    const labelW = doc.widthOfString(e.label);
    const numW = doc.widthOfString(num);
    const xLabel = MARGIN.left + indent;
    const xNum = PAGE.width - MARGIN.right - numW;
    doc
      .fillColor(e.level === 0 ? theme.fg : theme.muted)
      .text(e.label, xLabel, y, { lineBreak: false });
    // Pontilhado até o número da página.
    const pontoY = y + tamanho * 0.78;
    for (let px = xLabel + labelW + 6; px < xNum - 6; px += 4) {
      doc.circle(px, pontoY, 0.5).fill(theme.line);
    }
    doc
      .font(fonte)
      .fontSize(tamanho)
      .fillColor(e.level === 0 ? theme.brand : theme.muted)
      .text(num, xNum, y, { lineBreak: false });
    y += e.level === 0 ? 20 : 16;
  }
}

// ------------------------------------------------------------ páginas

function decorate(
  doc: Doc,
  theme: PdfTheme,
  opts: FormulasPdfOptions,
  primeira: number,
  materiaDaPagina: Map<number, string>,
): void {
  const range = doc.bufferedPageRange();
  const total = range.count - primeira;
  for (let i = primeira; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const topo = MARGIN.top - 32;
    drawMark(doc, MARGIN.left, topo - 3, 15, theme);
    doc
      .font(FONT.semibold)
      .fontSize(7.8)
      .fillColor(theme.muted)
      .text(opts.title, MARGIN.left + 22, topo + 1, {
        width: CONTENT_W - 180,
        lineBreak: false,
        ellipsis: true,
      });
    const materia = materiaDaPagina.get(i);
    const direita = `${materia ? `${materia}  ·  ` : ''}${i - primeira + 1} / ${total}`;
    doc.font(FONT.semibold).fontSize(7.8).fillColor(theme.muted);
    doc.text(
      direita,
      PAGE.width - MARGIN.right - doc.widthOfString(direita),
      topo + 1,
      {
        lineBreak: false,
      },
    );
    doc
      .moveTo(MARGIN.left, topo + 20)
      .lineTo(PAGE.width - MARGIN.right, topo + 20)
      .lineWidth(0.6)
      .stroke(theme.line);

    doc
      .font(FONT.regular)
      .fontSize(7)
      .fillColor(theme.muted)
      .text(
        'Gerado pelo OpENEM · software livre (AGPL-3.0)',
        MARGIN.left,
        PAGE.height - MARGIN.bottom + 24,
        { lineBreak: false },
      );
  }
}

function newPage(doc: Doc): void {
  doc.addPage({
    size: 'A4',
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
  });
}

/** Monta o documento (ainda aberto: quem chama faz o `end`). */
export function renderFormulasPdf(
  items: FormulaPdfItem[],
  options: FormulasPdfOptions,
): Doc {
  const base = resolveTheme(options.theme ?? null);
  const theme = options.brandColor
    ? themeWithBrand(base, options.brandColor)
    : base;
  const colunas = options.twoColumns === false ? 1 : 2;
  const colW = colunas === 2 ? (CONTENT_W - GUTTER) / 2 : CONTENT_W;

  const doc = new PDFDocument({
    size: 'A4',
    bufferPages: true,
    autoFirstPage: false,
    info: {
      Title: options.title,
      Author: 'OpENEM',
      Subject: 'Caderno de fórmulas do ENEM',
      Creator: 'OpENEM',
    },
  });
  registerFonts(doc);

  const grupos = groupFormulas(items);

  let paginaAtual = -1;
  const abrir = () => {
    newPage(doc);
    paginaAtual++;
  };

  if (options.cover !== false) {
    abrir();
    drawCover(doc, grupos, items, theme, options);
  }
  const comSumario = options.toc !== false;
  let paginaSumario = -1;
  if (comSumario) {
    abrir();
    paginaSumario = paginaAtual;
  }
  // Numeração do rodapé começa no sumário (ou no conteúdo, sem sumário).
  const primeiraNumerada = options.cover !== false ? 1 : 0;

  const entradas: Entrada[] = [];
  const materiaDaPagina = new Map<number, string>();
  const topo = MARGIN.top;
  const pe = PAGE.height - MARGIN.bottom;
  abrir();
  let y = topo;

  const FAIXA = 40;
  const ink = contrastInk(theme.brand);

  const novaPagina = () => {
    abrir();
    y = topo;
  };

  /** Título do assunto: barra da marca, nome e contagem, na largura toda. */
  const ASSUNTO = 34;
  const drawAssunto = (nome: string, total: number) => {
    doc.roundedRect(MARGIN.left, y + 3, 3, 16, 1.5).fill(theme.brand);
    doc
      .font(FONT.bold)
      .fontSize(11.5)
      .fillColor(theme.fg)
      .text(nome, MARGIN.left + 11, y + 4, {
        width: CONTENT_W - 110,
        lineBreak: false,
        ellipsis: true,
      });
    const n = plural(total, 'fórmula', 'fórmulas');
    doc.font(FONT.medium).fontSize(8.5).fillColor(theme.muted);
    doc.text(n, MARGIN.left + CONTENT_W - doc.widthOfString(n), y + 7, {
      lineBreak: false,
    });
    doc
      .moveTo(MARGIN.left, y + 24)
      .lineTo(MARGIN.left + CONTENT_W, y + 24)
      .lineWidth(0.6)
      .stroke(theme.line);
  };

  for (const g of grupos) {
    // Cada assunto é uma seção: título na largura toda e, embaixo, a grade
    // dos cartões dele em linhas com as faixas iguais.
    const assuntos = g.topics.map((t) => ({
      t,
      linhas: rows(
        t.items.map((f) => planCard(doc, f, colW, theme, options)),
        colunas,
      ).map(planLinha),
    }));

    // Faixa da matéria, na largura toda: só começa a página se couber junto
    // com o título do primeiro assunto e a primeira linha de cartões.
    const primeira = assuntos[0]?.linhas[0]?.height ?? 0;
    if (y + FAIXA + ASSUNTO + primeira > pe && y > topo) novaPagina();
    const grad = doc.linearGradient(MARGIN.left, y, MARGIN.left + CONTENT_W, y);
    grad.stop(0, theme.brand).stop(1, theme.brand2);
    doc.roundedRect(MARGIN.left, y, CONTENT_W, FAIXA - 10, 8).fill(grad);
    doc
      .font(FONT.extrabold)
      .fontSize(14)
      .fillColor(ink)
      .text(g.subject, MARGIN.left + 14, y + 8, { lineBreak: false });
    const conta = plural(g.count, 'fórmula', 'fórmulas');
    doc.font(FONT.semibold).fontSize(9).fillColor(ink);
    doc.text(
      conta,
      MARGIN.left + CONTENT_W - 14 - doc.widthOfString(conta),
      y + 11,
      {
        lineBreak: false,
      },
    );
    entradas.push({
      label: g.subject,
      page: paginaAtual,
      level: 0,
      count: g.count,
    });
    if (!materiaDaPagina.has(paginaAtual))
      materiaDaPagina.set(paginaAtual, g.subject);
    y += FAIXA;

    for (const { t, linhas } of assuntos) {
      // O título do assunto nunca fica sozinho no pé da página.
      if (y + ASSUNTO + linhas[0].height > pe && y > topo) novaPagina();
      if (!materiaDaPagina.has(paginaAtual))
        materiaDaPagina.set(paginaAtual, g.subject);
      drawAssunto(t.name, t.items.length);
      entradas.push({
        label: t.name,
        page: paginaAtual,
        level: 1,
        count: t.items.length,
      });
      y += ASSUNTO;

      for (const linha of linhas) {
        if (y + linha.height > pe && y > topo) {
          novaPagina();
          if (!materiaDaPagina.has(paginaAtual))
            materiaDaPagina.set(paginaAtual, g.subject);
        }
        linha.cards.forEach((card, i) =>
          card.draw(MARGIN.left + i * (colW + GUTTER), y, linha.faixas),
        );
        y += linha.height + CARD_GAP;
      }
      y += SECTION_GAP - CARD_GAP;
    }
    y += SECTION_GAP;
  }

  if (comSumario) {
    doc.switchToPage(paginaSumario);
    // Número impresso = posição a partir da primeira página numerada.
    drawToc(doc, entradas, theme, 1 - primeiraNumerada);
  }
  decorate(doc, theme, options, primeiraNumerada, materiaDaPagina);
  return doc;
}

/** Gera o PDF inteiro em memória — é o que o controller devolve. */
export function formulasPdfBuffer(
  items: FormulaPdfItem[],
  options: FormulasPdfOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = renderFormulasPdf(items, options);
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    } catch (e) {
      reject(e as Error);
    }
  });
}
