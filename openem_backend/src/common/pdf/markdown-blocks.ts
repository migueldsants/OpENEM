/**
 * Markdown → blocos de impressão. Puro, sem PDF e sem I/O.
 *
 * O enunciado das questões é Markdown com imagens, citações e, às vezes, verso.
 * O renderizador de PDF (`simulado-pdf.ts`) não sabe ler Markdown: ele desenha
 * parágrafo, imagem e linha. Este módulo faz a tradução — e é onde ficam as
 * decisões de tipografia que dão para testar sem abrir um PDF.
 *
 * A decisão menos óbvia é a de juntar linhas. O dataset do ENEM vem com quebra
 * rígida no meio das frases (a largura do caderno original), e imprimir isso
 * com texto justificado produz um bloco esburacado. Então parágrafo vira linha
 * corrida — EXCETO quando o trecho tem cara de verso (linhas curtas), porque aí
 * a quebra é do poema e destruí-la muda o texto.
 */

export type PdfBlock =
  | { kind: 'paragraph'; text: string; style?: 'normal' | 'quote' | 'heading' }
  /** Verso/citação com quebras próprias: cada linha é impressa como está. */
  | { kind: 'lines'; lines: string[] }
  | { kind: 'image'; url: string; alt?: string }
  /** Crédito da fonte ("Disponível em: ... Acesso em: ..."), em corpo menor. */
  | { kind: 'source'; text: string }
  /** Tabela em Markdown, já separada em células. */
  | { kind: 'table'; rows: string[][] };

/** Abaixo desta média de caracteres por linha, o trecho é tratado como verso. */
const VERSE_MAX_AVG = 46;

/**
 * Início do crédito da fonte. No caderno oficial ele vem em corpo menor e
 * itálico no fim do texto de apoio; colado ao parágrafo, parece enunciado.
 */
const SOURCE_START =
  /(Dispon[ií]vel\s+em\s*:|Acesso\s+em\s*:|Fonte\s*:|Adaptado\s+de\s*:)/i;

/**
 * Tira a marcação inline que não tem equivalente no desenho: negrito, itálico,
 * código e link (fica só o texto). O `$...$` do LaTeX é preservado — é melhor
 * mostrar a fórmula como o aluno a vê na tela do que apagá-la.
 */
export function stripInlineMarks(input: string): string {
  return input
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // imagem inline sai (vira bloco)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // link: fica o texto
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(?<![\w*])\*(?!\s)([^*\n]+?)\*(?![\w*])/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/** Todas as imagens citadas num Markdown, na ordem em que aparecem. */
export function extractImages(
  markdown: string,
): { url: string; alt: string }[] {
  const out: { url: string; alt: string }[] = [];
  const re = /!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    out.push({ alt: m[1], url: m[2] });
  }
  return out;
}

/** A linha é só uma imagem (com ou sem espaço em volta)? */
function isImageOnly(line: string): boolean {
  return /^\s*!\[[^\]]*\]\([^)\s]+[^)]*\)\s*$/.test(line);
}

function isTableRow(line: string): boolean {
  return /^\s*\|.*\|\s*$/.test(line);
}

/** Linha separadora de cabeçalho de tabela: |---|---| */
function isTableDivider(line: string): boolean {
  return /^\s*\|[\s:|-]+\|\s*$/.test(line);
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => stripInlineMarks(c));
}

/**
 * Onde começa o crédito da fonte dentro de um parágrafo, ou -1. Só conta
 * quando está no trecho final: "Disponível em" no meio do texto faz parte do
 * enunciado ("o gráfico disponível em ... mostra").
 */
export function lastSourceIndex(texto: string): number {
  let achado = -1;
  const re = new RegExp(SOURCE_START.source, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto)) !== null) achado = m.index;
  return achado > 0 && achado > texto.length * 0.6 ? achado : -1;
}

/** Parece verso/citação em linhas? */
function looksLikeVerse(lines: string[]): boolean {
  if (lines.length < 2) return false;
  const media = lines.reduce((a, l) => a + l.length, 0) / lines.length;
  return media < VERSE_MAX_AVG;
}

/**
 * Quebra um Markdown nos blocos que o PDF sabe desenhar.
 *
 * Ordem preservada: uma imagem no meio do texto continua no meio do texto, que
 * é o que faz o enunciado do ENEM ter sentido (o gráfico vem antes da pergunta).
 */
export function toPdfBlocks(markdown: string | null | undefined): PdfBlock[] {
  if (!markdown) return [];
  const linhas = markdown.replace(/\r\n?/g, '\n').split('\n');
  const blocos: PdfBlock[] = [];

  /** Acumulador do parágrafo corrente. */
  let buffer: string[] = [];
  let quote = false;

  function flush() {
    if (buffer.length === 0) return;
    const limpas = buffer
      .map((l) => stripInlineMarks(l))
      .filter((l) => l.length > 0);
    buffer = [];
    const eraQuote = quote;
    quote = false;
    if (limpas.length === 0) return;
    if (looksLikeVerse(limpas)) {
      // O crédito costuma vir nas últimas linhas do bloco de verso; ele não é
      // poema, então sai da estrofe e vai para o corpo menor.
      const versos: string[] = [];
      const creditos: string[] = [];
      for (const l of limpas) {
        if (creditos.length || SOURCE_START.test(l.slice(0, 20)))
          creditos.push(l);
        else versos.push(l);
      }
      if (versos.length) blocos.push({ kind: 'lines', lines: versos });
      if (creditos.length) {
        blocos.push({ kind: 'source', text: creditos.join(' ') });
      }
      return;
    }
    const texto = limpas.join(' ');
    // O crédito costuma vir grudado no fim do parágrafo; separado, o texto de
    // apoio termina onde de fato termina.
    const corte = lastSourceIndex(texto);
    if (corte > 0) {
      const antes = texto.slice(0, corte).trim();
      const fonte = texto.slice(corte).trim();
      if (antes) {
        blocos.push({
          kind: 'paragraph',
          text: antes,
          ...(eraQuote ? { style: 'quote' as const } : {}),
        });
      }
      blocos.push({ kind: 'source', text: fonte });
      return;
    }
    blocos.push({
      kind: 'paragraph',
      text: texto,
      ...(eraQuote ? { style: 'quote' as const } : {}),
    });
  }

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];

    if (linha.trim() === '') {
      flush();
      continue;
    }

    if (isImageOnly(linha)) {
      flush();
      const [img] = extractImages(linha);
      if (img) blocos.push({ kind: 'image', url: img.url, alt: img.alt });
      continue;
    }

    if (isTableRow(linha)) {
      flush();
      const rows: string[][] = [];
      while (i < linhas.length && isTableRow(linhas[i])) {
        if (!isTableDivider(linhas[i])) rows.push(parseTableRow(linhas[i]));
        i++;
      }
      i--; // o for incrementa
      if (rows.length) blocos.push({ kind: 'table', rows });
      continue;
    }

    const heading = /^\s{0,3}(#{1,6})\s+(.*)$/.exec(linha);
    if (heading) {
      flush();
      const texto = stripInlineMarks(heading[2]);
      if (texto)
        blocos.push({ kind: 'paragraph', text: texto, style: 'heading' });
      continue;
    }

    // Imagem no meio da linha: a imagem vira bloco próprio e o texto segue.
    const inline = extractImages(linha);
    if (inline.length > 0) {
      const resto = stripInlineMarks(linha);
      if (resto) buffer.push(resto);
      flush();
      for (const img of inline) {
        blocos.push({ kind: 'image', url: img.url, alt: img.alt });
      }
      continue;
    }

    // Crédito em linha própria: vira bloco de fonte, sem entrar no parágrafo.
    if (SOURCE_START.test(linha.trim().slice(0, 20))) {
      flush();
      const texto = stripInlineMarks(linha);
      if (texto) blocos.push({ kind: 'source', text: texto });
      continue;
    }

    if (/^\s*>/.test(linha)) {
      quote = true;
      buffer.push(linha.replace(/^\s*>\s?/, ''));
      continue;
    }

    // Item de lista: vira parágrafo próprio com marcador, para não colar no
    // texto anterior quando as linhas são juntadas.
    const item = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/.exec(linha);
    if (item) {
      flush();
      const texto = stripInlineMarks(item[1]);
      if (texto) blocos.push({ kind: 'paragraph', text: `• ${texto}` });
      continue;
    }

    buffer.push(linha);
  }
  flush();
  return blocos;
}

/**
 * Texto de uma alternativa para impressão: uma linha só, sem marcação. Uma
 * alternativa que é imagem devolve string vazia — quem desenha usa `imageUrl`.
 */
export function alternativeText(text: string | null | undefined): string {
  if (!text) return '';
  return stripInlineMarks(text.replace(/\n+/g, ' '));
}
