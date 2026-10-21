/**
 * Caderno de prova em PDF, no padrão do ENEM e com a identidade do OpENEM.
 *
 * Por que PDFKit e não um HTML impresso: o caderno precisa de duas colunas com
 * fluxo de verdade (um enunciado longo continua na coluna seguinte, como na
 * prova oficial), numeração "página X de Y" e imagens do disco. Fazer isso com
 * HTML exigiria um navegador headless — 300 MB de Chromium no container de uma
 * API enxuta, que divide um VPS pequeno com o banco. Aqui o custo é uma
 * dependência pequena e o controle é total.
 *
 * O que o PDF tem, na ordem:
 *   1. Capa: logo, nome do simulado, o que é o OpENEM, instruções e campo de nome.
 *   2. Caderno de questões em duas colunas (ou uma, se o aluno preferir).
 *   3. Cartão-resposta para preencher à mão.
 *   4. Gabarito (e o comentário de cada questão, quando houver e for pedido).
 *
 * A cor vem do tema escolhido pelo aluno (`themes.ts`), que é o mesmo tema da
 * interface. O texto é medido antes de ser desenhado: nada de bloco cortado no
 * fim da coluna.
 */

import { existsSync } from 'node:fs';
import { isAbsolute, join, normalize, sep } from 'node:path';
import PDFDocument from 'pdfkit';
import { MEDIA_PREFIX } from '../enem-import/mapping';
import { alternativeText, PdfBlock, toPdfBlocks } from './markdown-blocks';
import { contrastInk, PdfTheme, resolveTheme, themeWithBrand } from './themes';

export interface PdfAlternative {
  letter: string;
  text: string;
  imageUrl: string | null;
  isCorrect: boolean;
}

export interface PdfQuestion {
  /** Número impresso. Na prova oficial é o do caderno; no personalizado, a ordem. */
  number: number;
  code: string | null;
  areaName: string | null;
  subjectName: string | null;
  topicName: string | null;
  statement: string;
  questionPrompt: string | null;
  explanation: string | null;
  alternatives: PdfAlternative[];
}

export interface PdfOptions {
  title: string;
  /** Recorte do simulado: "Matemática · Funções · 20 questões". */
  subtitle?: string | null;
  /** Chave do tema de cor, ou o tema já resolvido. */
  theme?: string | PdfTheme | null;
  /** Cor da marca escolhida à mão (tema "custom" do app). */
  brandColor?: string | null;
  cover?: boolean;
  answerSheet?: boolean;
  answerKey?: boolean;
  explanations?: boolean;
  /** Duas colunas como o caderno oficial; false imprime em coluna única. */
  twoColumns?: boolean;
  timeLimitMin?: number | null;
  /** Raiz das imagens das questões (ENEM_MEDIA_DIR). */
  mediaDir?: string | null;
  /** Nome do aluno na capa; vazio imprime a linha para preencher à mão. */
  studentName?: string | null;
  /** Injetável para o teste não depender da data de hoje. */
  now?: Date;
}

/**
 * Descrição do projeto impressa na capa. Só promete o que o app tem hoje: a
 * tela de correção de redação saiu, e a questão oficial entra sem comentário.
 */
export const ABOUT_OPENEM =
  'O OpENEM é uma plataforma livre e de código aberto para quem vai prestar o ' +
  'ENEM: as provas oficiais de 1998 a 2025, simulados realistas, revisão ' +
  'espaçada, flashcards e acompanhamento de desempenho. É gratuito, não tem ' +
  'anúncio e não vende dados. O código é público e licenciado em AGPL-3.0, ' +
  'para qualquer escola ou professor poder usar, adaptar e hospedar.';

/** Linha sob a marca, na capa. O OpENEM não tem domínio oficial. */
export const COVER_ORIGIN = 'Simulado gerado pelo OpENEM';

/**
 * Três destaques no pé da capa: dizem, em uma linha cada, o que o aluno
 * encontra no app que gerou este caderno.
 */
export const COVER_HIGHLIGHTS: [string, string][] = [
  ['Provas oficiais', 'O ENEM de 1998 a 2025, com gabarito.'],
  ['Treino sob medida', 'Simulado por tema, revisão dos erros e flashcards.'],
  ['Seu ritmo', 'Revisão espaçada, metas e desempenho por assunto.'],
];

export const INSTRUCTIONS = [
  'Confira, antes de começar, se este caderno contém todas as questões indicadas na capa.',
  'Use apenas caneta esferográfica de tinta preta ou azul para preencher o cartão-resposta.',
  'Marque uma única alternativa por questão; questão com duas marcas é anulada.',
  'O tempo sugerido é o da capa. Cronometre: administrar o tempo faz parte da prova.',
  'Confira o gabarito só no fim: corrigir no meio do caminho distorce o resultado.',
];

/** Medidas do caderno, em pontos (1 pt = 1/72"). A4 = 595,28 × 841,89. */
const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = { top: 54, bottom: 52, left: 44, right: 44 };
const GUTTER = 22;
/** Altura da faixa de cabeçalho das páginas de questões. */
const HEADER_H = 30;

const FONT = {
  body: 'Helvetica',
  bold: 'Helvetica-Bold',
  italic: 'Helvetica-Oblique',
};

const SIZE = {
  statement: 8.8,
  alternative: 8.8,
  label: 7.6,
  title: 26,
  subtitle: 11,
  section: 13,
};

type Doc = PDFKit.PDFDocument;

/**
 * `openImage` existe no PDFKit mas não em @types/pdfkit — é como se descobre o
 * tamanho da imagem antes de desenhá-la, e sem o tamanho não há como decidir se
 * ela cabe na coluna.
 */
function imageSize(
  doc: Doc,
  caminho: string,
): { width: number; height: number } {
  const api = doc as unknown as {
    openImage(p: string): { width: number; height: number };
  };
  return api.openImage(caminho);
}

/**
 * Resolve a imagem de uma questão para um caminho de arquivo.
 *
 * Só aceita caminho sob `mediaDir`: a URL vem do banco, mas o banco é
 * alimentado por um importador, e um `../../etc/passwd` ali não pode virar
 * leitura de arquivo. URL externa (http) é ignorada — o PDF é gerado offline.
 */
export function resolveImagePath(
  url: string,
  mediaDir?: string | null,
): string | null {
  if (!mediaDir || !url) return null;
  const limpo = url.trim();
  if (!limpo.startsWith(`${MEDIA_PREFIX}/`)) return null;
  const relativo = limpo.slice(MEDIA_PREFIX.length + 1);
  if (!relativo || relativo.includes('\0')) return null;
  const base = normalize(isAbsolute(mediaDir) ? mediaDir : join(mediaDir));
  const alvo = normalize(join(base, ...relativo.split('/')));
  if (!alvo.startsWith(base.endsWith(sep) ? base : base + sep)) return null;
  if (!/\.(png|jpe?g)$/i.test(alvo)) return null; // PDFKit só embute PNG/JPEG
  return existsSync(alvo) ? alvo : null;
}

/** Gerencia colunas, quebras de página e o cursor vertical. */
class Layout {
  readonly top = MARGIN.top + HEADER_H;
  readonly bottom = PAGE.height - MARGIN.bottom;
  readonly columnWidth: number;
  column = 0;
  y: number;

  constructor(
    private readonly doc: Doc,
    readonly columns: number,
  ) {
    const util = PAGE.width - MARGIN.left - MARGIN.right;
    this.columnWidth =
      columns === 1 ? util : (util - GUTTER * (columns - 1)) / columns;
    this.y = this.top;
  }

  get x(): number {
    return MARGIN.left + this.column * (this.columnWidth + GUTTER);
  }

  get available(): number {
    return this.bottom - this.y;
  }

  /** Abre a próxima coluna; esgotadas, abre uma página. */
  next(): void {
    if (this.column + 1 < this.columns) {
      this.column += 1;
      this.y = this.top;
      return;
    }
    this.newPage();
  }

  newPage(): void {
    this.doc.addPage();
    // Margem inferior zerada: quem decide a quebra é este Layout. Com a margem
    // real, o PDFKit inseria uma página sozinho no meio de um bloco medido.
    this.doc.page.margins.bottom = 0;
    this.column = 0;
    this.y = this.top;
  }

  /** Garante `altura` de espaço, mudando de coluna se preciso. */
  ensure(altura: number): void {
    if (this.y + altura > this.bottom) this.next();
  }
}

/** Marca do OpENEM: o quadrado arredondado com "Op" e "EM" do ícone do app. */
function drawLogoMark(
  doc: Doc,
  x: number,
  y: number,
  size: number,
  theme: PdfTheme,
): void {
  doc.save();
  doc
    .roundedRect(x, y, size, size, size * 0.2)
    .fill(theme.fg === '#111827' ? '#0f172a' : '#0f172a');
  doc
    .font(FONT.bold)
    .fontSize(size * 0.36)
    .fillColor('#ffffff')
    .text('Op', x, y + size * 0.17, { width: size, align: 'center' });
  doc
    .font(FONT.bold)
    .fontSize(size * 0.24)
    .fillColor(theme.brand)
    .text('EM', x, y + size * 0.58, { width: size, align: 'center' });
  doc.restore();
}

/** "OpENEM" como assinatura tipográfica, com o "EM" na cor da marca. */
function drawWordmark(
  doc: Doc,
  x: number,
  y: number,
  size: number,
  inkColor: string,
  accentColor: string,
  accentOpacity = 1,
): number {
  doc.font(FONT.bold).fontSize(size);
  const op = doc.widthOfString('Op');
  doc.fillColor(inkColor).text('Op', x, y, { lineBreak: false });
  doc.fillColor(accentColor).opacity(accentOpacity);
  doc.text('ENEM', x + op, y, { lineBreak: false });
  doc.opacity(1);
  return op + doc.widthOfString('ENEM');
}

/** 330 → "5h30". */
export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

/** 11/09/2026 — cabe na ficha da capa, que tem uma linha só. */
function formatShortDate(d: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

/** Áreas presentes na prova, na ordem em que aparecem. */
function areasOf(questions: PdfQuestion[]): string[] {
  const out: string[] = [];
  for (const q of questions) {
    if (q.areaName && !out.includes(q.areaName)) out.push(q.areaName);
  }
  return out;
}

/** "Linguagens, Códigos e suas Tecnologias" → "Linguagens". */
export function shortArea(name: string): string {
  return name
    .replace(' e suas Tecnologias', '')
    .replace('Linguagens, Códigos', 'Linguagens')
    .replace('Ciências da ', '')
    .replace('Ciências ', '');
}

// ---------------------------------------------------------------- capa

function drawCover(
  doc: Doc,
  questions: PdfQuestion[],
  opts: Required<Pick<PdfOptions, 'title'>> & PdfOptions,
  theme: PdfTheme,
): void {
  const agora = opts.now ?? new Date();
  const ink = contrastInk(theme.brand);
  const faixaH = 286;

  // Faixa superior com gradiente da marca.
  const grad = doc.linearGradient(0, 0, PAGE.width, faixaH);
  grad.stop(0, theme.brand).stop(1, theme.brand2);
  doc.rect(0, 0, PAGE.width, faixaH).fill(grad);

  // Marca d'água discreta: o "EM" gigante no canto, recortado pela faixa.
  doc.save();
  doc.rect(0, 0, PAGE.width, faixaH).clip();
  doc
    .font(FONT.bold)
    .fontSize(190)
    .fillColor(ink)
    .opacity(0.07)
    .text('EM', PAGE.width - 230, faixaH - 170, { lineBreak: false });
  doc.restore();
  doc.opacity(1);

  drawLogoMark(doc, MARGIN.left, 46, 52, theme);
  drawWordmark(doc, MARGIN.left + 64, 58, 22, ink, ink, 0.62);
  doc
    .font(FONT.body)
    .fontSize(8.5)
    .fillColor(ink)
    .opacity(0.85)
    .text(COVER_ORIGIN, MARGIN.left + 64, 84, {
      lineBreak: false,
    });
  doc.opacity(1);

  // Título e recorte.
  const larguraTitulo = PAGE.width - MARGIN.left - MARGIN.right - 40;
  // Corpo do título cai até caber acima das fichas: um nome de simulado
  // personalizado pode ser bem mais longo que "ENEM 2023 · 1º dia".
  let corpoTitulo = SIZE.title;
  doc.font(FONT.bold).fontSize(corpoTitulo);
  while (
    corpoTitulo > 15 &&
    doc.heightOfString(opts.title, { width: larguraTitulo }) > 74
  ) {
    corpoTitulo -= 1.5;
    doc.fontSize(corpoTitulo);
  }
  // Título alinhado por BAIXO: assim ele encosta nas fichas sempre à mesma
  // distância, com uma linha ou com três.
  const alturaTitulo = doc.heightOfString(opts.title, { width: larguraTitulo });
  let alturaSub = 0;
  if (opts.subtitle) {
    doc.font(FONT.body).fontSize(SIZE.subtitle);
    alturaSub =
      Math.min(
        doc.heightOfString(opts.subtitle, { width: larguraTitulo }),
        30,
      ) + 5;
  }
  const yTitulo = Math.max(116, faixaH - 92 - (alturaTitulo + alturaSub));
  doc
    .font(FONT.bold)
    .fontSize(corpoTitulo)
    .fillColor(ink)
    .text(opts.title, MARGIN.left, yTitulo, { width: larguraTitulo });
  if (opts.subtitle) {
    doc
      .font(FONT.body)
      .fontSize(SIZE.subtitle)
      .fillColor(ink)
      .opacity(0.9)
      .text(opts.subtitle, MARGIN.left, yTitulo + alturaTitulo + 3, {
        width: larguraTitulo,
        height: 30,
        ellipsis: true,
      });
    doc.opacity(1);
  }

  // Fichas com os números da prova.
  const fichas: [string, string][] = [
    ['Questões', String(questions.length)],
    ...(opts.timeLimitMin
      ? ([['Tempo sugerido', formatDuration(opts.timeLimitMin)]] as [
          string,
          string,
        ][])
      : []),
    ['Gerado em', formatShortDate(agora)],
  ];
  const fichaW =
    (PAGE.width - MARGIN.left - MARGIN.right - 12 * (fichas.length - 1)) /
    fichas.length;
  let fx = MARGIN.left;
  const fy = faixaH - 74;
  for (const [rotulo, valor] of fichas) {
    doc.save();
    doc.roundedRect(fx, fy, fichaW, 52, 8).fillOpacity(0.16).fill(ink);
    doc.restore();
    doc
      .font(FONT.body)
      .fontSize(7.5)
      .fillColor(ink)
      .opacity(0.85)
      .text(rotulo.toUpperCase(), fx + 12, fy + 10, {
        width: fichaW - 24,
        characterSpacing: 0.6,
      });
    doc.opacity(1);
    doc
      .font(FONT.bold)
      .fontSize(14)
      .fillColor(ink)
      .text(valor, fx + 12, fy + 24, { width: fichaW - 24 });
    fx += fichaW + 12;
  }

  // Áreas do conhecimento presentes.
  let y = faixaH + 26;
  const areas = areasOf(questions);
  if (areas.length) {
    doc
      .font(FONT.bold)
      .fontSize(SIZE.label)
      .fillColor(theme.muted)
      .text('ÁREAS NESTE CADERNO', MARGIN.left, y, { characterSpacing: 0.8 });
    y += 14;
    let cx = MARGIN.left;
    doc.font(FONT.body).fontSize(9);
    for (const area of areas) {
      const texto = shortArea(area);
      const w = doc.widthOfString(texto) + 22;
      if (cx + w > PAGE.width - MARGIN.right) {
        cx = MARGIN.left;
        y += 22;
      }
      doc.roundedRect(cx, y - 4, w, 18, 9).fill(theme.surface);
      doc.circle(cx + 9, y + 5, 3).fill(theme.brand);
      doc
        .font(FONT.body)
        .fontSize(9)
        .fillColor(theme.fg)
        .text(texto, cx + 16, y, { lineBreak: false });
      cx += w + 8;
    }
    y += 30;
  }

  // Instruções.
  const boxW = PAGE.width - MARGIN.left - MARGIN.right;
  doc
    .font(FONT.bold)
    .fontSize(SIZE.section)
    .fillColor(theme.fg)
    .text('Instruções', MARGIN.left, y);
  y = doc.y + 6;
  doc.font(FONT.body).fontSize(9).fillColor(theme.fg);
  for (let i = 0; i < INSTRUCTIONS.length; i++) {
    const texto = INSTRUCTIONS[i];
    const h = doc.heightOfString(texto, { width: boxW - 26, lineGap: 1.5 });
    doc
      .font(FONT.bold)
      .fontSize(8)
      .fillColor(theme.brand)
      .text(String(i + 1).padStart(2, '0'), MARGIN.left, y + 0.5, {
        width: 16,
        lineBreak: false,
      });
    doc
      .font(FONT.body)
      .fontSize(9)
      .fillColor(theme.fg)
      .text(texto, MARGIN.left + 20, y, { width: boxW - 26, lineGap: 1.5 });
    y += h + 6;
  }

  // Campo de identificação: o caderno é para imprimir e responder à mão.
  y += 10;
  doc.roundedRect(MARGIN.left, y, boxW, 56, 10).fill(theme.surface);
  doc
    .font(FONT.bold)
    .fontSize(SIZE.label)
    .fillColor(theme.muted)
    .text('NOME', MARGIN.left + 16, y + 12, { characterSpacing: 0.8 });
  if (opts.studentName) {
    doc
      .font(FONT.bold)
      .fontSize(12)
      .fillColor(theme.fg)
      .text(opts.studentName, MARGIN.left + 16, y + 26);
  } else {
    doc
      .moveTo(MARGIN.left + 16, y + 40)
      .lineTo(MARGIN.left + boxW * 0.62, y + 40)
      .lineWidth(0.7)
      .stroke(theme.line);
  }
  doc
    .font(FONT.bold)
    .fontSize(SIZE.label)
    .fillColor(theme.muted)
    .text('DATA', MARGIN.left + boxW * 0.7, y + 12, { characterSpacing: 0.8 });
  doc
    .moveTo(MARGIN.left + boxW * 0.7, y + 40)
    .lineTo(MARGIN.left + boxW - 16, y + 40)
    .lineWidth(0.7)
    .stroke(theme.line);
  y += 74;

  // Sobre o projeto.
  doc
    .font(FONT.bold)
    .fontSize(SIZE.section)
    .fillColor(theme.fg)
    .text('O que é o OpENEM', MARGIN.left, y);
  doc
    .font(FONT.body)
    .fontSize(9)
    .fillColor(theme.muted)
    .text(ABOUT_OPENEM, MARGIN.left, doc.y + 5, {
      width: boxW,
      align: 'justify',
      lineGap: 2,
    });

  // Destaques no pé da capa: preenchem o espaço que sobra.
  const destaques = COVER_HIGHLIGHTS;
  const destaqueW = (boxW - 24) / 3;
  const yDestaques = PAGE.height - MARGIN.bottom - 56;
  doc
    .moveTo(MARGIN.left, yDestaques - 16)
    .lineTo(PAGE.width - MARGIN.right, yDestaques - 16)
    .lineWidth(0.7)
    .stroke(theme.line);
  for (let i = 0; i < destaques.length; i++) {
    const [titulo, texto] = destaques[i];
    const dx = MARGIN.left + i * (destaqueW + 12);
    doc.rect(dx, yDestaques, 14, 2).fill(theme.brand);
    doc
      .font(FONT.bold)
      .fontSize(8.5)
      .fillColor(theme.fg)
      .text(titulo, dx, yDestaques + 8, { width: destaqueW });
    doc
      .font(FONT.body)
      .fontSize(7.6)
      .fillColor(theme.muted)
      .text(texto, dx, doc.y + 1, { width: destaqueW });
  }

  // Rodapé da capa.
  const rodape = PAGE.height - MARGIN.bottom + 10;
  doc
    .moveTo(MARGIN.left, rodape - 12)
    .lineTo(PAGE.width - MARGIN.right, rodape - 12)
    .lineWidth(0.7)
    .stroke(theme.line);
  doc
    .font(FONT.body)
    .fontSize(7.5)
    .fillColor(theme.muted)
    .text(
      'OpENEM · software livre (AGPL-3.0) · questões de autoria do Inep/MEC, ' +
        'reproduzidas para fins educacionais.',
      MARGIN.left,
      rodape - 6,
      { width: boxW },
    );
}

// ------------------------------------------------------------- questões

/** Desenha o cabeçalho "QUESTÃO 01" com a faixa da cor do tema. */
function drawQuestionLabel(
  doc: Doc,
  layout: Layout,
  q: PdfQuestion,
  theme: PdfTheme,
): void {
  const x = layout.x;
  const w = layout.columnWidth;
  const ink = contrastInk(theme.brand);
  const rotulo = `QUESTÃO ${String(q.number).padStart(2, '0')}`;

  doc.font(FONT.bold).fontSize(SIZE.label);
  const labelW = doc.widthOfString(rotulo) + 16;
  doc.roundedRect(x, layout.y, labelW, 14, 3).fill(theme.brand);
  doc.fillColor(ink).text(rotulo, x + 8, layout.y + 3.8, {
    lineBreak: false,
    characterSpacing: 0.5,
  });

  // Assunto/área à direita, quando couber — orienta o aluno sem poluir.
  const tema = q.topicName ?? (q.areaName ? shortArea(q.areaName) : null);
  if (tema) {
    doc.font(FONT.body).fontSize(SIZE.label).fillColor(theme.muted);
    const temaW = doc.widthOfString(tema);
    if (labelW + temaW + 10 <= w) {
      doc.text(tema, x + w - temaW, layout.y + 3.8, { lineBreak: false });
    }
  }
  layout.y += 20;
}

/**
 * Escreve um texto que pode atravessar colunas: mede, desenha o que cabe e
 * segue na coluna seguinte. É isso que faz o caderno parecer o do ENEM em vez
 * de uma sequência de blocos que pulam de página inteiros.
 */
function drawFlowingText(
  doc: Doc,
  layout: Layout,
  texto: string,
  estilo: {
    font: string;
    size: number;
    color: string;
    align?: 'justify' | 'left';
    lineGap?: number;
    /** Respiro depois do bloco; 3 pt é o intervalo entre parágrafos. */
    spacingAfter?: number;
  },
): void {
  const {
    font,
    size,
    color,
    align = 'justify',
    lineGap = 1.8,
    spacingAfter = 3,
  } = estilo;
  let restante = texto.trim();
  let guarda = 0;

  while (restante && guarda++ < 200) {
    doc.font(font).fontSize(size);
    const opcoes = { width: layout.columnWidth, align, lineGap };
    const alturaTotal = doc.heightOfString(restante, opcoes);

    if (alturaTotal <= layout.available) {
      doc
        .fillColor(color)
        .text(restante, layout.x, layout.y, { ...opcoes, height: alturaTotal });
      layout.y += alturaTotal + spacingAfter;
      return;
    }

    // Não cabe inteiro. Sem espaço útil para pelo menos três linhas, muda de
    // coluna antes de partir — uma linha órfã no pé da coluna é pior.
    const linha = doc.currentLineHeight(true) + lineGap;
    if (layout.available < linha * 3) {
      layout.next();
      continue;
    }

    // Busca binária pelo maior pedaço (em palavras) que cabe no espaço atual.
    const palavras = restante.split(/\s+/);
    let lo = 1;
    let hi = palavras.length - 1;
    let melhor = 0;
    while (lo <= hi) {
      const meio = Math.floor((lo + hi) / 2);
      const pedaco = palavras.slice(0, meio).join(' ');
      if (doc.heightOfString(pedaco, opcoes) <= layout.available) {
        melhor = meio;
        lo = meio + 1;
      } else {
        hi = meio - 1;
      }
    }
    if (melhor === 0) {
      layout.next();
      continue;
    }
    const pedaco = palavras.slice(0, melhor).join(' ');
    const h = doc.heightOfString(pedaco, opcoes);
    doc
      .fillColor(color)
      .text(pedaco, layout.x, layout.y, { ...opcoes, height: h });
    restante = palavras.slice(melhor).join(' ');
    layout.next();
  }
}

/** Desenha uma imagem ajustada à coluna; ausente, deixa o aviso no lugar. */
function drawImage(
  doc: Doc,
  layout: Layout,
  url: string,
  theme: PdfTheme,
  mediaDir?: string | null,
  /**
   * Fração da coluna que a imagem pode ocupar. Imagem de ALTERNATIVA entra
   * menor: são frações e fórmulas exportadas em resolução alta, e no tamanho
   * natural uma alternativa "1/2" ocupava meia coluna.
   */
  maxRatio = 1,
): void {
  const caminho = resolveImagePath(url, mediaDir);
  const maxW = layout.columnWidth * maxRatio;

  if (caminho) {
    try {
      const img = imageSize(doc, caminho);
      const escala = Math.min(1, maxW / img.width);
      const maxH = layout.bottom - layout.top;
      let w = img.width * escala;
      let h = img.height * escala;
      if (h > maxH) {
        const r = maxH / h;
        w *= r;
        h *= r;
      }
      layout.ensure(h + 6);
      doc.image(caminho, layout.x + (layout.columnWidth - w) / 2, layout.y, {
        width: w,
        height: h,
      });
      layout.y += h + 6;
      return;
    } catch {
      // Formato que o PDFKit não embute (bmp, svg): cai no aviso abaixo.
    }
  }

  layout.ensure(26);
  doc
    .roundedRect(layout.x, layout.y, layout.columnWidth, 20, 4)
    .fill(theme.surface);
  doc
    .font(FONT.italic)
    .fontSize(7.5)
    .fillColor(theme.muted)
    .text('[imagem disponível no aplicativo]', layout.x + 8, layout.y + 6.5, {
      width: layout.columnWidth - 16,
      lineBreak: false,
    });
  layout.y += 26;
}

/** Tabela simples: cabeçalho em negrito e filete entre as linhas. */
function drawTable(
  doc: Doc,
  layout: Layout,
  rows: string[][],
  theme: PdfTheme,
): void {
  const cols = Math.max(...rows.map((r) => r.length));
  const cellW = layout.columnWidth / cols;
  doc.fontSize(7.8);

  for (let r = 0; r < rows.length; r++) {
    const linha = rows[r];
    const fonte = r === 0 ? FONT.bold : FONT.body;
    doc.font(fonte);
    const alturas = linha.map((c) =>
      doc.heightOfString(c, { width: cellW - 6 }),
    );
    const h = Math.max(12, ...alturas) + 4;
    layout.ensure(h);
    if (r === 0) {
      doc.rect(layout.x, layout.y, layout.columnWidth, h).fill(theme.surface);
    }
    for (let c = 0; c < linha.length; c++) {
      doc
        .font(fonte)
        .fontSize(7.8)
        .fillColor(theme.fg)
        .text(linha[c], layout.x + c * cellW + 3, layout.y + 2.5, {
          width: cellW - 6,
        });
    }
    doc
      .moveTo(layout.x, layout.y + h)
      .lineTo(layout.x + layout.columnWidth, layout.y + h)
      .lineWidth(0.4)
      .stroke(theme.line);
    layout.y += h;
  }
  layout.y += 5;
}

/**
 * Altura necessária para o começo do enunciado caber junto do cabeçalho.
 * Texto pede três linhas (o bastante para não ficar uma linha órfã); imagem
 * pede a altura real, porque ela não se parte.
 */
function firstBlockHeight(
  doc: Doc,
  layout: Layout,
  blocos: PdfBlock[],
  opts: PdfOptions,
): number {
  const bloco = blocos[0];
  if (!bloco) return 24;
  if (bloco.kind === 'image') {
    const caminho = resolveImagePath(bloco.url, opts.mediaDir);
    if (!caminho) return 30;
    try {
      const img = imageSize(doc, caminho);
      const escala = Math.min(1, layout.columnWidth / img.width);
      return Math.min(img.height * escala, layout.bottom - layout.top) + 8;
    } catch {
      return 30;
    }
  }
  doc.font(FONT.body).fontSize(SIZE.statement);
  return Math.min(24, doc.currentLineHeight(true) * 3);
}

function drawBlocks(
  doc: Doc,
  layout: Layout,
  blocos: PdfBlock[],
  theme: PdfTheme,
  opts: PdfOptions,
): void {
  for (const bloco of blocos) {
    switch (bloco.kind) {
      case 'paragraph':
        drawFlowingText(doc, layout, bloco.text, {
          font:
            bloco.style === 'heading'
              ? FONT.bold
              : bloco.style === 'quote'
                ? FONT.italic
                : FONT.body,
          size:
            bloco.style === 'heading' ? SIZE.statement + 0.8 : SIZE.statement,
          color: theme.fg,
          align: bloco.style === 'heading' ? 'left' : 'justify',
        });
        break;
      case 'lines':
        // Verso: linha a linha, sem justificar (a quebra é do texto) e sem o
        // respiro entre parágrafos — senão o poema sai com o dobro do corpo.
        for (const linha of bloco.lines) {
          drawFlowingText(doc, layout, linha, {
            font: FONT.body,
            size: SIZE.statement,
            color: theme.fg,
            align: 'left',
            lineGap: 0.6,
            spacingAfter: 0.5,
          });
        }
        layout.y += 4;
        break;
      case 'source':
        drawFlowingText(doc, layout, bloco.text, {
          font: FONT.italic,
          size: SIZE.statement - 1.3,
          color: theme.muted,
          align: 'left',
          lineGap: 0.8,
        });
        break;
      case 'image':
        drawImage(doc, layout, bloco.url, theme, opts.mediaDir);
        break;
      case 'table':
        drawTable(doc, layout, bloco.rows, theme);
        break;
    }
  }
}

function drawAlternatives(
  doc: Doc,
  layout: Layout,
  q: PdfQuestion,
  theme: PdfTheme,
  opts: PdfOptions,
): void {
  const raio = 5.6;
  const recuo = 17;

  for (const alt of q.alternatives) {
    const texto = alternativeText(alt.text);
    const largura = layout.columnWidth - recuo;
    doc.font(FONT.body).fontSize(SIZE.alternative);
    const h = texto
      ? doc.heightOfString(texto, { width: largura, lineGap: 1 })
      : 0;

    // A letra e a primeira linha não se separam: garante espaço para as duas.
    layout.ensure(Math.min(h, 24) + 6);
    const topo = layout.y;

    doc
      .circle(layout.x + raio + 1, topo + raio + 1.2, raio)
      .lineWidth(0.7)
      .stroke(theme.line);
    doc
      .font(FONT.bold)
      .fontSize(7.2)
      .fillColor(theme.fg)
      .text(alt.letter, layout.x, topo + 2.6, {
        width: (raio + 1) * 2,
        align: 'center',
        lineBreak: false,
      });

    if (texto) {
      const cabe = h <= layout.available;
      if (cabe) {
        doc
          .font(FONT.body)
          .fontSize(SIZE.alternative)
          .fillColor(theme.fg)
          .text(texto, layout.x + recuo, topo, {
            width: largura,
            lineGap: 1,
            height: h,
          });
        layout.y = topo + h + 4;
      } else {
        // Alternativa longa demais para o resto da coluna: a letra já foi
        // desenhada aqui, então o texto começa recuado e continua na seguinte.
        layout.y = topo;
        drawFlowingTextIndented(doc, layout, texto, recuo, theme);
      }
    } else {
      layout.y = topo + (raio + 1) * 2 + 2;
    }

    if (alt.imageUrl) {
      drawImage(doc, layout, alt.imageUrl, theme, opts.mediaDir, 0.62);
    }
  }
}

/** Texto de alternativa que atravessa coluna, preservando o recuo da letra. */
function drawFlowingTextIndented(
  doc: Doc,
  layout: Layout,
  texto: string,
  recuo: number,
  theme: PdfTheme,
): void {
  const largura = layout.columnWidth - recuo;
  const opcoes = { width: largura, lineGap: 1 } as const;
  let restante = texto;
  let guarda = 0;
  while (restante && guarda++ < 100) {
    doc.font(FONT.body).fontSize(SIZE.alternative);
    const h = doc.heightOfString(restante, opcoes);
    if (h <= layout.available) {
      doc
        .fillColor(theme.fg)
        .text(restante, layout.x + recuo, layout.y, { ...opcoes, height: h });
      layout.y += h + 4;
      return;
    }
    const palavras = restante.split(/\s+/);
    let melhor = 0;
    for (let i = 1; i <= palavras.length; i++) {
      const pedaco = palavras.slice(0, i).join(' ');
      if (doc.heightOfString(pedaco, opcoes) > layout.available) break;
      melhor = i;
    }
    if (melhor === 0) {
      layout.next();
      continue;
    }
    const pedaco = palavras.slice(0, melhor).join(' ');
    doc.fillColor(theme.fg).text(pedaco, layout.x + recuo, layout.y, {
      ...opcoes,
      height: doc.heightOfString(pedaco, opcoes),
    });
    restante = palavras.slice(melhor).join(' ');
    layout.next();
  }
}

// -------------------------------------------------- cartão-resposta e gabarito

function drawSectionTitle(
  doc: Doc,
  theme: PdfTheme,
  titulo: string,
  descricao: string,
): number {
  const boxW = PAGE.width - MARGIN.left - MARGIN.right;
  doc.rect(MARGIN.left, MARGIN.top, 3, 26).fill(theme.brand);
  doc
    .font(FONT.bold)
    .fontSize(18)
    .fillColor(theme.fg)
    .text(titulo, MARGIN.left + 12, MARGIN.top);
  doc
    .font(FONT.body)
    .fontSize(8.5)
    .fillColor(theme.muted)
    .text(descricao, MARGIN.left + 12, doc.y + 2, { width: boxW - 12 });
  return doc.y + 16;
}

function drawAnswerSheet(
  doc: Doc,
  questions: PdfQuestion[],
  theme: PdfTheme,
): void {
  doc.addPage();
  doc.page.margins.bottom = 0;
  let y = drawSectionTitle(
    doc,
    theme,
    'Cartão-resposta',
    'Preencha totalmente o círculo da alternativa escolhida, com caneta preta ou azul. Uma marca por questão.',
  );

  const colunas = 4;
  const util = PAGE.width - MARGIN.left - MARGIN.right;
  const colW = util / colunas;
  const linhaH = 17;
  const raio = 4.6;
  const letras = ['A', 'B', 'C', 'D', 'E'];
  // Distribui entre as colunas em vez de encher a primeira: 45 questões viram
  // quatro colunas curtas, que é como o cartão oficial se parece.
  const maxLinhas = Math.max(
    1,
    Math.floor((PAGE.height - MARGIN.bottom - y) / linhaH),
  );
  const porColuna = Math.min(maxLinhas, Math.ceil(questions.length / colunas));

  let indice = 0;
  while (indice < questions.length) {
    const topo = y;
    for (let c = 0; c < colunas && indice < questions.length; c++) {
      const x = MARGIN.left + c * colW;
      y = topo;
      for (let r = 0; r < porColuna && indice < questions.length; r++) {
        const q = questions[indice++];
        // Zebra por linha DA COLUNA: com o índice global o sombreado saía
        // desalinhado entre as colunas.
        if (r % 2 === 1) {
          doc.rect(x, y - 2, colW - 8, linhaH - 1).fill(theme.surface);
        }
        doc
          .font(FONT.bold)
          .fontSize(7.6)
          .fillColor(theme.muted)
          .text(String(q.number).padStart(3, '0'), x + 2, y + 2.5, {
            width: 18,
            lineBreak: false,
          });
        for (let i = 0; i < letras.length; i++) {
          const cx = x + 26 + i * (raio * 2 + 7);
          doc
            .circle(cx, y + 6.5, raio)
            .lineWidth(0.7)
            .stroke(theme.line);
          doc
            .font(FONT.body)
            .fontSize(5.2)
            .fillColor(theme.muted)
            .text(letras[i], cx - raio, y + 4.6, {
              width: raio * 2,
              align: 'center',
              lineBreak: false,
            });
        }
        y += linhaH;
      }
    }
    if (indice < questions.length) {
      doc.addPage();
      doc.page.margins.bottom = 0;
      y = MARGIN.top;
    }
  }
}

function drawAnswerKey(
  doc: Doc,
  questions: PdfQuestion[],
  theme: PdfTheme,
  comExplicacao: boolean,
): void {
  doc.addPage();
  doc.page.margins.bottom = 0;
  let y = drawSectionTitle(
    doc,
    theme,
    'Gabarito',
    'Corrija depois de terminar a prova inteira. Erro vale mais que acerto: volte ao enunciado antes de ver o comentário.',
  );

  const colunas = 6;
  const util = PAGE.width - MARGIN.left - MARGIN.right;
  const colW = util / colunas;
  const linhaH = 18;
  const ink = contrastInk(theme.brand);
  const linhas = Math.ceil(questions.length / colunas);

  for (let r = 0; r < linhas; r++) {
    for (let c = 0; c < colunas; c++) {
      const i = r * colunas + c;
      if (i >= questions.length) break;
      const q = questions[i];
      const correta = q.alternatives.find((a) => a.isCorrect);
      const x = MARGIN.left + c * colW;
      doc.roundedRect(x, y, colW - 6, linhaH - 3, 4).fill(theme.surface);
      doc
        .font(FONT.body)
        .fontSize(7.6)
        .fillColor(theme.muted)
        .text(String(q.number).padStart(3, '0'), x + 7, y + 4, {
          lineBreak: false,
        });
      const bx = x + colW - 24;
      doc.circle(bx, y + 7.5, 6.6).fill(theme.brand);
      doc
        .font(FONT.bold)
        .fontSize(7.6)
        .fillColor(ink)
        .text(correta?.letter ?? '—', bx - 6.6, y + 4.6, {
          width: 13.2,
          align: 'center',
          lineBreak: false,
        });
    }
    y += linhaH;
    if (y + linhaH > PAGE.height - MARGIN.bottom) {
      doc.addPage();
      doc.page.margins.bottom = 0;
      y = MARGIN.top;
    }
  }

  if (!comExplicacao) return;
  const comentadas = questions.filter((q) => q.explanation?.trim());
  if (comentadas.length === 0) return;

  doc.addPage();
  doc.page.margins.bottom = 0;
  drawSectionTitle(
    doc,
    theme,
    'Resolução comentada',
    `${comentadas.length} de ${questions.length} questões deste caderno têm comentário.`,
  );
  const layout = new Layout(doc, 2);
  layout.y = doc.y + 10;
  for (const q of comentadas) {
    const correta = q.alternatives.find((a) => a.isCorrect);
    layout.ensure(40);
    doc
      .font(FONT.bold)
      .fontSize(SIZE.label)
      .fillColor(theme.brand)
      .text(
        `QUESTÃO ${String(q.number).padStart(2, '0')} · ${correta?.letter ?? '—'}`,
        layout.x,
        layout.y,
        { lineBreak: false, characterSpacing: 0.5 },
      );
    layout.y += 13;
    drawBlocks(doc, layout, toPdfBlocks(q.explanation), theme, {
      title: '',
      mediaDir: null,
    });
    layout.y += 6;
  }
}

// ------------------------------------------------------------- decoração

/**
 * Cabeçalho e rodapé de todas as páginas, desenhados no fim — é quando se sabe
 * o total para escrever "página X de Y".
 */
function decoratePages(
  doc: Doc,
  theme: PdfTheme,
  opts: PdfOptions,
  comCapa: boolean,
): void {
  const range = doc.bufferedPageRange();
  const total = range.count;
  for (let i = 0; i < total; i++) {
    if (comCapa && i === 0) continue;
    doc.switchToPage(range.start + i);

    const yTopo = MARGIN.top - 18;
    drawLogoMark(doc, MARGIN.left, yTopo - 4, 14, theme);
    doc
      .font(FONT.bold)
      .fontSize(7.6)
      .fillColor(theme.muted)
      .text(opts.title, MARGIN.left + 20, yTopo, {
        width: PAGE.width - MARGIN.left - MARGIN.right - 120,
        lineBreak: false,
        ellipsis: true,
      });
    const paginacao = `${i + 1} / ${total}`;
    doc.font(FONT.bold).fontSize(7.6).fillColor(theme.muted);
    doc.text(
      paginacao,
      PAGE.width - MARGIN.right - doc.widthOfString(paginacao),
      yTopo,
      { lineBreak: false },
    );
    doc
      .moveTo(MARGIN.left, MARGIN.top - 2)
      .lineTo(PAGE.width - MARGIN.right, MARGIN.top - 2)
      .lineWidth(0.7)
      .stroke(theme.line);

    const yBase = PAGE.height - MARGIN.bottom + 16;
    doc
      .font(FONT.body)
      .fontSize(6.8)
      .fillColor(theme.muted)
      .text(
        'Gerado pelo OpENEM · software livre (AGPL-3.0)',
        MARGIN.left,
        yBase,
        {
          lineBreak: false,
        },
      );
  }
}

/** Filete vertical entre as colunas, como no caderno oficial. */
function drawColumnRules(
  doc: Doc,
  theme: PdfTheme,
  paginas: number[],
  colunas: number,
): void {
  if (colunas < 2) return;
  const range = doc.bufferedPageRange();
  const util = PAGE.width - MARGIN.left - MARGIN.right;
  const colW = (util - GUTTER * (colunas - 1)) / colunas;
  for (const p of paginas) {
    if (p < range.start || p >= range.start + range.count) continue;
    doc.switchToPage(p);
    for (let c = 1; c < colunas; c++) {
      const x = MARGIN.left + c * colW + GUTTER * (c - 1) + GUTTER / 2;
      doc
        .moveTo(x, MARGIN.top + HEADER_H - 10)
        .lineTo(x, PAGE.height - MARGIN.bottom)
        .lineWidth(0.5)
        .stroke(theme.line);
    }
  }
}

// ------------------------------------------------------------------ público

/** Cria o documento e desenha o caderno inteiro. */
export function renderSimuladoPdf(
  questions: PdfQuestion[],
  options: PdfOptions,
): Doc {
  const theme =
    typeof options.theme === 'object' && options.theme
      ? options.theme
      : resolveThemeWithBrand(options);
  const comCapa = options.cover !== false;
  const colunas = options.twoColumns === false ? 1 : 2;

  const doc = new PDFDocument({
    size: 'A4',
    bufferPages: true,
    margins: { ...MARGIN },
    info: {
      Title: options.title,
      Author: 'OpENEM',
      Subject: options.subtitle ?? 'Simulado ENEM',
      Creator: 'OpENEM',
    },
  });
  doc.page.margins.bottom = 0;

  if (comCapa) {
    drawCover(doc, questions, { ...options, title: options.title }, theme);
    doc.addPage();
    doc.page.margins.bottom = 0;
  }

  // Páginas de questões, para o filete das colunas depois.
  const paginasDeQuestao: number[] = [doc.bufferedPageRange().count - 1];
  const layout = new Layout(doc, colunas);
  let paginaAtual = paginasDeQuestao[0];

  for (const q of questions) {
    // Cabeçalho e começo do enunciado ficam juntos: "QUESTÃO 07" sozinha no pé
    // da coluna é o defeito mais visível de um caderno gerado. Por isso o
    // primeiro bloco é MEDIDO antes — uma questão que abre com imagem precisa
    // de muito mais espaço que uma que abre com texto.
    const blocos = toPdfBlocks(q.statement);
    layout.ensure(20 + firstBlockHeight(doc, layout, blocos, options));
    drawQuestionLabel(doc, layout, q, theme);
    drawBlocks(doc, layout, blocos, theme, options);
    if (q.questionPrompt?.trim()) {
      drawFlowingText(doc, layout, q.questionPrompt, {
        font: FONT.bold,
        size: SIZE.statement,
        color: theme.fg,
      });
    }
    layout.y += 2;
    drawAlternatives(doc, layout, q, theme, options);
    layout.y += 10;

    const atual = doc.bufferedPageRange().count - 1;
    if (atual !== paginaAtual) {
      for (let p = paginaAtual + 1; p <= atual; p++) paginasDeQuestao.push(p);
      paginaAtual = atual;
    }
  }

  if (options.answerSheet !== false) drawAnswerSheet(doc, questions, theme);
  if (options.answerKey !== false) {
    drawAnswerKey(doc, questions, theme, options.explanations === true);
  }

  drawColumnRules(doc, theme, paginasDeQuestao, colunas);
  decoratePages(doc, theme, options, comCapa);
  return doc;
}

function resolveThemeWithBrand(options: PdfOptions): PdfTheme {
  const base = resolveTheme(
    typeof options.theme === 'string' ? options.theme : null,
  );
  return options.brandColor ? themeWithBrand(base, options.brandColor) : base;
}

/** Gera o PDF inteiro em memória — é o que o controller devolve. */
export function simuladoPdfBuffer(
  questions: PdfQuestion[],
  options: PdfOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = renderSimuladoPdf(questions, options);
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
