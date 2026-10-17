// Gabarito oficial das provas que o INEP publica sem gabarito na página de
// provas: o ENEM de 1998 a 2008 e a PPL de 2010 e 2011. Ele existe, mas só
// dentro dos microdados do próprio INEP (download.inep.gov.br/microdados):
//
// - 1998–2008: cada linha dos microdados traz o gabarito da prova do aluno
//   (TX_GABARITO_OBJETIVA, pela cor em CO_PROVA), e a pasta "PROVAS E
//   GABARITOS" do zip traz o gabarito do caderno amarelo em PDF. As duas
//   fontes são conferidas uma contra a outra; o PDF de 2008 é imagem e foi
//   conferido à mão (bate com os microdados nas 63 questões).
// - PPL 2010 e 2011: ITENS_PROVA_<ano>.csv traz o gabarito item a item por
//   código de prova. Em 2011 ele é conferido com o PDF de gabarito da PPL que
//   está no mesmo zip; onde as duas fontes oficiais discordam, a questão fica
//   sem gabarito (e fora do dataset).
//
// Lê só os trechos necessários dos zips (HTTP Range) e grava
// gabaritos-antigos.json, que o criar.mjs usa.
//
// uso: node gabaritos-antigos.mjs [--only=1998,2010-reaplicacao]
import './globals.mjs';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { listarZip, lerEntrada } from './zip-remoto.mjs';

const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',');
const SAIDA = new URL('./gabaritos-antigos.json', import.meta.url);
const zip = (ano) => `https://download.inep.gov.br/microdados/microdados_enem_${ano}.zip`;

/** Linhas de texto de um PDF (itens agrupados pela altura). */
async function linhasPdf(buf) {
  const doc = await getDocument({ data: new Uint8Array(buf), verbosity: 0 }).promise;
  const linhas = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    const its = tc.items.filter((i) => i.str.trim()).map((i) => ({ x: i.transform[4], y: i.transform[5], s: i.str.trim() }));
    its.sort((a, b) => b.y - a.y || a.x - b.x);
    let atual = null;
    for (const it of its) {
      if (atual && Math.abs(atual.y - it.y) <= 3) atual.its.push(it);
      else linhas.push((atual = { y: it.y, its: [it] }));
    }
  }
  return linhas.map((l) => l.its.sort((a, b) => a.x - b.x).map((i) => i.s).join(' '));
}

/**
 * Gabarito lido de um PDF de gabarito: pares "Q12 B" / "12 B" / "91 E B"
 * (inglês e espanhol) e a tabela horizontal de 2006 ("Questão 1 2 3" em cima
 * de "Gabarito B D C"). Mapa número → letra ou { ingles, espanhol }.
 */
export function gabaritoDoTexto(linhas) {
  const g = new Map();
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    if (/^Quest\S*\s+\d/.test(l) && /^Gabarito\s/i.test(linhas[i + 1] ?? '')) {
      const ns = l.match(/\d+/g).map(Number);
      const ls = linhas[i + 1].replace(/^Gabarito\s*/i, '').split(/\s+/);
      ns.forEach((n, k) => g.set(n, /^[A-E]$/.test(ls[k]) ? ls[k] : 'ANULADA'));
      i++;
      continue;
    }
    for (const [, n, a, b] of l.matchAll(/(?:^|\s)Q?(\d{1,3})\s+([A-E]|Anulad\w*)(?:\s+([A-E]|Anulad\w*))?(?=\s|$)/gi)) {
      const v = (x) => (/^[A-E]$/.test(x) ? x : 'ANULADA');
      g.set(+n, b ? { ingles: v(a), espanhol: v(b) } : v(a));
    }
  }
  return g;
}

/** Gabaritos distintos por CO_PROVA nas primeiras linhas dos microdados. */
export function gabaritosPorProva(csv, colProva = 'CO_PROVA', colGab = 'TX_GABARITO_OBJETIVA') {
  const linhas = csv.split(/\r?\n/);
  const cab = linhas[0].split(';').map((s) => s.replace(/"/g, ''));
  const iP = cab.indexOf(colProva), iG = cab.indexOf(colGab);
  if (iP < 0 || iG < 0) throw new Error(`colunas ${colProva}/${colGab} ausentes`);
  const por = new Map();
  // a última linha pode estar cortada no meio (lemos só o começo do arquivo)
  for (const l of linhas.slice(1, -1)) {
    const c = l.split(';').map((s) => s.replace(/"/g, '').trim());
    if (!c[iP] || !c[iG]) continue;
    if (!por.has(c[iP])) por.set(c[iP], new Map());
    const m = por.get(c[iP]);
    m.set(c[iG], (m.get(c[iG]) ?? 0) + 1);
  }
  return por;
}

/** ITENS_PROVA: código da prova → [{ pos, gab, lingua }] em ordem. */
export function itensPorProva(csv) {
  const linhas = csv.trim().split(/\r?\n/);
  const cab = linhas[0].split(';');
  const col = (n) => cab.indexOf(n);
  const [iPos, iGab, iProva, iLing] = [col('CO_POSICAO'), col('TX_GABARITO'), col('CO_PROVA'), col('TP_LINGUA')];
  const m = new Map();
  for (const l of linhas.slice(1)) {
    const c = l.split(';').map((s) => s.trim());
    if (!m.has(c[iProva])) m.set(c[iProva], []);
    m.get(c[iProva]).push({ pos: +c[iPos], gab: /^[A-E]$/.test(c[iGab]) ? c[iGab] : 'ANULADA', lingua: c[iLing] === '0' ? 'ingles' : c[iLing] === '1' ? 'espanhol' : null });
  }
  return m;
}

const entrada = (es, re) => {
  const e = es.find((x) => re.test(x.nome));
  if (!e) throw new Error(`entrada ${re} não achada no zip`);
  return e;
};

async function antigo(ano) {
  const es = await listarZip(zip(ano));
  const csv = (await lerEntrada(entrada(es, /MICRODADOS_ENEM_\d{4}\.csv$/i), 600_000)).toString('latin1');
  const por = gabaritosPorProva(csv);
  // a amarela é "A" até 2004 e "1" de 2005 em diante
  const codigo = por.has('A') ? 'A' : '1';
  const distintos = [...(por.get(codigo) ?? new Map()).keys()];
  if (distintos.length !== 1) throw new Error(`${ano}: ${distintos.length} gabaritos para a prova ${codigo}`);
  const micro = distintos[0];
  if (micro.length !== 63) throw new Error(`${ano}: gabarito com ${micro.length} letras`);
  // O zip de 2004 traz o gabarito de 2004 com o nome de 2005; o título do PDF
  // diz o ano, e é ele que vale.
  const pdf = entrada(es, /PROVAS E GABARITOS\/.*GAB.*AMARELA\.pdf$/i);
  const linhas = await linhasPdf(await lerEntrada(pdf));
  const titulo = linhas.slice(0, 8).join(' ');
  const g = gabaritoDoTexto(linhas);
  let conferencia;
  if (g.size === 0) conferencia = 'PDF de gabarito em imagem: conferido à mão contra os microdados';
  else {
    if (!titulo.includes(String(ano))) throw new Error(`${ano}: o PDF ${pdf.nome} é de outro ano (${titulo.slice(0, 60)})`);
    const dif = [...micro].map((l, i) => (g.get(i + 1) === l ? null : `${i + 1}: pdf=${g.get(i + 1)} microdados=${l}`)).filter(Boolean);
    if (dif.length) throw new Error(`${ano}: PDF e microdados discordam — ${dif.join('; ')}`);
    conferencia = `PDF ${pdf.nome.split('/').pop()} = microdados (CO_PROVA ${codigo}) nas 63 questões`;
  }
  return {
    fonte: `${zip(ano)} — DADOS/MICRODADOS_ENEM_${ano}.csv, TX_GABARITO_OBJETIVA da prova amarela (CO_PROVA=${codigo})`,
    conferencia,
    gabarito: Object.fromEntries([...micro].map((l, i) => [i + 1, l])),
  };
}

// Códigos da PPL nos ITENS_PROVA, área por área, na ordem do caderno.
const PPL = {
  2010: { codigos: ['101', '105', '111', '115'], caderno: 'caderno azul (1 no 1º dia, 7 no 2º)' },
  2011: { codigos: ['134', '133', '135', '136'], caderno: 'caderno branco (3) no 1º dia e cinza (6) no 2º', pdfs: [/P2_GAB_03/, /P2_GAB_06/] },
};

async function ppl(ano) {
  const cfg = PPL[ano];
  const es = await listarZip(zip(ano));
  const itens = itensPorProva((await lerEntrada(entrada(es, /ITENS_PROVA_\d{4}\.csv$/i))).toString('latin1'));
  const gab = {};
  for (const cod of cfg.codigos) {
    const lista = itens.get(cod);
    if (!lista?.length) throw new Error(`${ano}: prova ${cod} ausente no ITENS_PROVA`);
    for (const it of lista) {
      if (it.lingua) gab[it.pos] = { ...(gab[it.pos] ?? {}), [it.lingua]: it.gab };
      else gab[it.pos] = it.gab;
    }
  }
  if (Object.keys(gab).length !== 180) throw new Error(`${ano}: ${Object.keys(gab).length} posições`);
  const conflitos = {};
  let conferencia = 'ITENS_PROVA (sem PDF de gabarito da PPL no zip)';
  if (!cfg.pdfs) {
    // Sem PDF: confere com o gabarito gravado nas linhas dos alunos que fizeram
    // essas provas (no inglês, que é o idioma da maioria).
    const csv = (await lerEntrada(entrada(es, /MICRODADOS_ENEM_\d{4}\.csv$/i), 1_500_000)).toString('latin1');
    const areas = ['CH', 'CN', 'LC', 'MT'];
    const partes = [];
    cfg.codigos.forEach((cod, k) => {
      const a = areas[k];
      const vistos = gabaritosPorProva(csv, `CO_PROVA_${a}`, `TX_GABARITO_${a}`).get(cod);
      if (!vistos) return;
      const esperado = itens.get(cod).filter((i) => i.lingua !== 'espanhol').map((i) => i.gab).join('');
      for (const [g, n] of vistos) {
        if (g !== esperado) throw new Error(`${ano}: prova ${cod} — microdados (${n} alunos) diferem do ITENS_PROVA`);
        partes.push(`${cod}: ${n} alunos`);
      }
    });
    if (partes.length) conferencia = `ITENS_PROVA = gabarito dos alunos nos microdados (${partes.join(', ')})`;
  }
  if (cfg.pdfs) {
    let iguais = 0;
    for (const re of cfg.pdfs) {
      const g = gabaritoDoTexto(await linhasPdf(await lerEntrada(entrada(es, re))));
      for (const [n, v] of g) {
        const atual = gab[n];
        if (atual === undefined) continue;
        for (const lingua of typeof atual === 'object' ? ['ingles', 'espanhol'] : [null]) {
          const a = lingua ? atual[lingua] : atual;
          const b = lingua ? (typeof v === 'object' ? v[lingua] : v) : typeof v === 'object' ? null : v;
          if (a === b) { iguais++; continue; }
          const chave = lingua ? `${n}-${lingua}` : String(n);
          conflitos[chave] = `ITENS_PROVA=${a}, PDF=${b}`;
          if (lingua) atual[lingua] = null;
          else gab[n] = null;
        }
      }
    }
    conferencia = `ITENS_PROVA x PDF de gabarito da PPL: ${iguais} iguais, ${Object.keys(conflitos).length} divergentes (ficam sem gabarito)`;
  }
  return {
    fonte: `${zip(ano)} — DADOS/ITENS_PROVA_${ano}.csv, provas ${cfg.codigos.join('/')} (${cfg.caderno})`,
    conferencia,
    ...(Object.keys(conflitos).length ? { conflitos } : {}),
    gabarito: gab,
  };
}

const alvos = [
  ...[1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008].map((a) => [String(a), () => antigo(a)]),
  ['2010-reaplicacao', () => ppl(2010)],
  ['2011-reaplicacao', () => ppl(2011)],
];
if (process.argv[1]?.endsWith('gabaritos-antigos.mjs')) {
  const saida = existsSync(SAIDA) ? JSON.parse(readFileSync(SAIDA, 'utf8')) : {};
  for (const [slug, f] of alvos) {
    if (ONLY && !ONLY.includes(slug)) continue;
    saida[slug] = await f();
    console.log(slug, '—', saida[slug].conferencia);
    writeFileSync(SAIDA, JSON.stringify(saida, null, 1) + '\n');
  }
}
