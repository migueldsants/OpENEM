// Lê arquivos de dentro de um .zip remoto sem baixar o zip inteiro: o
// diretório central vem do fim do arquivo (HTTP Range) e cada entrada é lida
// do seu próprio trecho. Os microdados do ENEM têm de 25 MB a 630 MB, e o que
// interessa (o gabarito) ocupa poucos KB.
import zlib from 'node:zlib';

// O servidor do INEP derruba conexões com frequência: tenta de novo.
async function comRetentativa(f) {
  for (let t = 1; ; t++) {
    try {
      return await f();
    } catch (e) {
      if (t >= 5 || /Range|não é um zip|HTTP 4/.test(e.message)) throw e;
      await new Promise((r) => setTimeout(r, 2000 * t));
    }
  }
}

function trecho(url, a, b) {
  return comRetentativa(async () => {
    const r = await fetch(url, { headers: { Range: `bytes=${a}-${b}` } });
    if (r.status !== 206) throw new Error(`${url}: o servidor não aceitou Range (HTTP ${r.status})`);
    return Buffer.from(await r.arrayBuffer());
  });
}

/** Entradas do zip: nome, método, tamanhos e posição do cabeçalho local. */
export async function listarZip(url) {
  const head = await comRetentativa(() => fetch(url, { method: 'HEAD' }));
  if (!head.ok) throw new Error(`${url}: HTTP ${head.status}`);
  const tamanho = Number(head.headers.get('content-length'));
  const cauda = await trecho(url, Math.max(0, tamanho - 65536 - 22), tamanho - 1);
  const eocd = cauda.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error(`${url}: não é um zip`);
  let cdTam = cauda.readUInt32LE(eocd + 12);
  let cdPos = cauda.readUInt32LE(eocd + 16);
  const loc64 = cauda.lastIndexOf(Buffer.from([0x50, 0x4b, 0x06, 0x07]));
  if (cdPos === 0xffffffff && loc64 >= 0) {
    const pos64 = Number(cauda.readBigUInt64LE(loc64 + 8));
    const z = await trecho(url, pos64, pos64 + 55);
    cdTam = Number(z.readBigUInt64LE(40));
    cdPos = Number(z.readBigUInt64LE(48));
  }
  const cd = await trecho(url, cdPos, cdPos + cdTam - 1);
  const entradas = [];
  for (let p = 0; p < cd.length && cd.readUInt32LE(p) === 0x02014b50; ) {
    const metodo = cd.readUInt16LE(p + 10);
    let comprimido = cd.readUInt32LE(p + 20), original = cd.readUInt32LE(p + 24);
    const nl = cd.readUInt16LE(p + 28), xl = cd.readUInt16LE(p + 30), cl = cd.readUInt16LE(p + 32);
    let pos = cd.readUInt32LE(p + 42);
    // nome em CP437/latin1; os acentos não importam para achar a entrada
    const nome = cd.subarray(p + 46, p + 46 + nl).toString('latin1');
    for (let x = p + 46 + nl; x < p + 46 + nl + xl; ) {
      const id = cd.readUInt16LE(x), len = cd.readUInt16LE(x + 2);
      if (id === 1) {
        let q = x + 4;
        if (original === 0xffffffff) { original = Number(cd.readBigUInt64LE(q)); q += 8; }
        if (comprimido === 0xffffffff) { comprimido = Number(cd.readBigUInt64LE(q)); q += 8; }
        if (pos === 0xffffffff) pos = Number(cd.readBigUInt64LE(q));
      }
      x += 4 + len;
    }
    entradas.push({ url, nome, metodo, comprimido, original, pos });
    p += 46 + nl + xl + cl;
  }
  return entradas;
}

/**
 * Conteúdo de uma entrada. `max` limita os bytes comprimidos lidos: o deflate
 * descomprime em fluxo, então dá para ler só o começo de um CSV enorme.
 */
export async function lerEntrada(e, max = Infinity) {
  const lh = await trecho(e.url, e.pos, e.pos + 29);
  const ini = e.pos + 30 + lh.readUInt16LE(26) + lh.readUInt16LE(28);
  const n = Math.min(max, e.comprimido);
  if (n === 0) return Buffer.alloc(0);
  const dados = await trecho(e.url, ini, ini + n - 1);
  if (e.metodo === 0) return dados;
  if (e.metodo !== 8) throw new Error(`${e.nome}: compressão ${e.metodo} não suportada`);
  return zlib.inflateRawSync(dados, { finishFlush: zlib.constants.Z_SYNC_FLUSH });
}
