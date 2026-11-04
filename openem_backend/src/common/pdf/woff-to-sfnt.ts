/**
 * WOFF (1.0) → TTF/OTF, em memória.
 *
 * Por quê: o fontkit do PDFKit lê WOFF descomprimindo a tabela com um inflate
 * em JavaScript puro A CADA ACESSO — e o layout da Inter acessa GSUB/GPOS a
 * cada palavra medida. Um caderno vazio levava mais de 1 s só nisso. Com a
 * fonte já descomprimida (zlib nativo, uma vez por processo), cai para
 * milissegundos. O formato é simples: as mesmas tabelas, sem compressão, com
 * o diretório do sfnt na frente.
 */

import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const WOFF_SIGNATURE = 0x774f4646; // 'wOFF'

export function woffToSfnt(woff: Buffer): Buffer {
  if (woff.length < 44 || woff.readUInt32BE(0) !== WOFF_SIGNATURE) {
    throw new Error('não é um arquivo WOFF 1.0');
  }
  const flavor = woff.readUInt32BE(4);
  const numTables = woff.readUInt16BE(12);

  const tabelas: { tag: number; checksum: number; data: Buffer }[] = [];
  for (let i = 0; i < numTables; i++) {
    const e = 44 + i * 20;
    const tag = woff.readUInt32BE(e);
    const offset = woff.readUInt32BE(e + 4);
    const compLength = woff.readUInt32BE(e + 8);
    const origLength = woff.readUInt32BE(e + 12);
    const checksum = woff.readUInt32BE(e + 16);
    const bruto = woff.subarray(offset, offset + compLength);
    const data = compLength < origLength ? inflateSync(bruto) : bruto;
    if (data.length !== origLength) {
      throw new Error('tabela WOFF com tamanho inconsistente');
    }
    tabelas.push({ tag, checksum, data });
  }
  // O diretório do sfnt vai em ordem de tag (o WOFF já costuma vir assim).
  tabelas.sort((a, b) => a.tag - b.tag);

  const potencia = 2 ** Math.floor(Math.log2(numTables));
  const cabecalho = 12 + numTables * 16;
  const total = tabelas.reduce(
    (soma, t) => soma + ((t.data.length + 3) & ~3),
    cabecalho,
  );
  const out = Buffer.alloc(total);
  out.writeUInt32BE(flavor, 0);
  out.writeUInt16BE(numTables, 4);
  out.writeUInt16BE(potencia * 16, 6);
  out.writeUInt16BE(Math.log2(potencia), 8);
  out.writeUInt16BE(numTables * 16 - potencia * 16, 10);

  let pos = cabecalho;
  tabelas.forEach((t, i) => {
    const r = 12 + i * 16;
    out.writeUInt32BE(t.tag, r);
    out.writeUInt32BE(t.checksum, r + 4);
    out.writeUInt32BE(pos, r + 8);
    out.writeUInt32BE(t.data.length, r + 12);
    t.data.copy(out, pos);
    pos += (t.data.length + 3) & ~3; // tabelas alinhadas em 4 bytes
  });
  return out;
}

/** Início e tamanho de uma tabela do sfnt, pelo diretório. */
function findTable(sfnt: Buffer, tag: string): number | null {
  const numTables = sfnt.readUInt16BE(4);
  for (let i = 0; i < numTables; i++) {
    const r = 12 + i * 16;
    if (sfnt.toString('latin1', r, r + 4) === tag) {
      return sfnt.readUInt32BE(r + 8);
    }
  }
  return null;
}

/** Ascendente, descendente e entrelinha do `hhea`, em fração do em. */
export function verticalMetrics(sfnt: Buffer): {
  ascent: number;
  descent: number;
  lineGap: number;
} {
  const head = findTable(sfnt, 'head');
  const hhea = findTable(sfnt, 'hhea');
  if (head === null || hhea === null) throw new Error('fonte sem head/hhea');
  const em = sfnt.readUInt16BE(head + 18);
  return {
    ascent: sfnt.readInt16BE(hhea + 4) / em,
    descent: sfnt.readInt16BE(hhea + 6) / em,
    lineGap: sfnt.readInt16BE(hhea + 8) / em,
  };
}

/**
 * Cópia de `alvo` com as métricas verticais (`hhea`) de `referencia`.
 *
 * O PDFKit põe a linha de base de cada trecho pela ascendente da fonte do
 * trecho, e mede a altura da linha pela fonte corrente. A MathJax_Main, a
 * fonte de símbolos, declara ascendente de 0,03 em (métrica de fonte web do
 * MathJax): o "≡" saía acima da linha. Com as métricas da Inter, o símbolo
 * fica na mesma linha de base e a linha tem a mesma altura. Os glifos não
 * mudam: só onde o PDFKit põe a linha de base.
 */
export function withVerticalMetricsOf(
  alvo: Buffer,
  referencia: Buffer,
): Buffer {
  const m = verticalMetrics(referencia);
  const out = Buffer.from(alvo);
  const head = findTable(out, 'head');
  const hhea = findTable(out, 'hhea');
  if (head === null || hhea === null) throw new Error('fonte sem head/hhea');
  const em = out.readUInt16BE(head + 18);
  out.writeInt16BE(Math.round(m.ascent * em), hhea + 4);
  out.writeInt16BE(Math.round(m.descent * em), hhea + 6);
  out.writeInt16BE(Math.round(m.lineGap * em), hhea + 8);
  return out;
}

const cache = new Map<string, Buffer>();

/** Lê e converte uma vez por processo; os arquivos não mudam em execução. */
export function loadWoffAsSfnt(caminho: string): Buffer {
  let fonte = cache.get(caminho);
  if (!fonte) {
    fonte = woffToSfnt(readFileSync(caminho));
    cache.set(caminho, fonte);
  }
  return fonte;
}
