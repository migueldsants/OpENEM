import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import PDFDocument from 'pdfkit';
import {
  loadWoffAsSfnt,
  verticalMetrics,
  withVerticalMetricsOf,
  woffToSfnt,
} from './woff-to-sfnt';

const INTER = join(
  dirname(require.resolve('inter-ui/package.json')),
  'Inter (web)',
  'Inter-Regular.woff',
);
const MATHJAX = join(
  dirname(require.resolve('mathjax-full/package.json')),
  'es5/output/chtml/fonts/woff-v2/MathJax_Main-Regular.woff',
);

/** Mede o texto com a fonte registrada — prova que o PDFKit a lê. */
function larguraCom(fonte: Buffer, texto: string): number {
  const doc = new PDFDocument();
  doc.registerFont('F', fonte);
  return doc.font('F').fontSize(10).widthOfString(texto);
}

describe('woffToSfnt', () => {
  it('gera um TTF com as mesmas tabelas do WOFF', () => {
    const woff = readFileSync(INTER);
    const ttf = woffToSfnt(woff);
    expect(ttf.readUInt32BE(0)).toBe(woff.readUInt32BE(4)); // flavor
    expect(ttf.readUInt16BE(4)).toBe(woff.readUInt16BE(12)); // numTables
    // Tabelas descomprimidas: o TTF é maior que o WOFF.
    expect(ttf.length).toBeGreaterThan(woff.length);
  });

  it('o PDFKit mede o texto igual pelo WOFF e pelo TTF convertido', () => {
    const texto = 'Cr₂O₃ (g · mol⁻¹) → reação';
    const pelaConversao = larguraCom(woffToSfnt(readFileSync(INTER)), texto);
    const doc = new PDFDocument();
    doc.registerFont('W', INTER);
    const peloWoff = doc.font('W').fontSize(10).widthOfString(texto);
    expect(pelaConversao).toBeGreaterThan(0);
    expect(pelaConversao).toBeCloseTo(peloWoff, 6);
  });

  it('recusa o que não é WOFF 1.0', () => {
    expect(() => woffToSfnt(Buffer.from('nao e fonte'))).toThrow(/WOFF/);
  });

  it('converte uma vez e reaproveita', () => {
    expect(loadWoffAsSfnt(INTER)).toBe(loadWoffAsSfnt(INTER));
  });
});

describe('withVerticalMetricsOf', () => {
  it('a fonte de símbolos passa a ter a ascendente e a descendente da Inter', () => {
    const inter = loadWoffAsSfnt(INTER);
    const mathjax = loadWoffAsSfnt(MATHJAX);
    // A MathJax_Main declara ascendente quase nula: o símbolo subia da linha.
    expect(verticalMetrics(mathjax).ascent).toBeLessThan(0.1);

    const ajustada = withVerticalMetricsOf(mathjax, inter);
    const alvo = verticalMetrics(inter);
    const obtida = verticalMetrics(ajustada);
    expect(obtida.ascent).toBeCloseTo(alvo.ascent, 2);
    expect(obtida.descent).toBeCloseTo(alvo.descent, 2);
    // Não altera a original (que está no cache) e os glifos continuam lá.
    expect(verticalMetrics(mathjax).ascent).toBeLessThan(0.1);
    expect(larguraCom(ajustada, '≡')).toBeCloseTo(larguraCom(mathjax, '≡'), 6);
  });
});
