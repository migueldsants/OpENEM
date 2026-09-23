// Corrige o dataset do updated-enem-api a partir dos cadernos oficiais do INEP:
// questões sem alternativas (ou com texto corrompido) são refeitas do PDF.
//
// uso: node build.mjs <dataset/public> <dir dos pdfs> [--dry] [--only=2021-reaplicacao]
import './globals.mjs';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { parsePdf } from './parse.mjs';
import { cropPng } from './render.mjs';
import { lerGabarito as lerGabaritoPdf } from './gabarito.mjs';

/** Gabarito oficial da prova (null quando o arquivo não existe). */
const lerGabarito = async (file, caderno) => (file && existsSync(join(pdfDir, file)) ? lerGabaritoPdf(join(pdfDir, file), caderno) : null);

const [root, pdfDir, ...flags] = process.argv.slice(2);
const DRY = flags.includes('--dry');
const ONLY = flags.find((f) => f.startsWith('--only='))?.slice(7).split(',');

// Caderno usado por dia de cada prova. `text` é o PDF de onde sai o texto
// (2021 precisa da versão com as fontes consertadas); `render` o original.
const EXAMS = {
  '2017-reaplicacao': [{ pdf: '2017_D1az_fix.pdf', render: '2017_D1az.pdf', gb: null }, { pdf: '2017_D2_fix.pdf', render: '2017_D2.pdf', gb: 'GB_2017_D2.pdf' }],
  '2018-reaplicacao': [{ pdf: '2018_D1_fix.pdf', render: '2018_D1.pdf' }, { pdf: '2018_D2_fix.pdf', render: '2018_D2.pdf' }],
  '2019-reaplicacao': [{ pdf: '2019_D1_fix.pdf', render: '2019_D1.pdf', gb: 'GB_2019_D1.pdf' }, { pdf: '2019_D2_fix.pdf', render: '2019_D2.pdf', gb: 'GB_2019_D2.pdf' }],
  '2020-reaplicacao': [{ pdf: '2020_D1_fix.pdf', render: '2020_D1.pdf', gb: 'GB_2020_D1.pdf' }, { pdf: '2020_D2_fix.pdf', render: '2020_D2.pdf', gb: 'GB_2020_D2.pdf' }],
  '2021-reaplicacao': [
    { pdf: '2021_D1_fix.pdf', render: '2021_D1.pdf', gb: 'GB_2021_D1.pdf' },
    { pdf: '2021_D2_fix.pdf', render: '2021_D2.pdf', gb: 'GB_2021_D2.pdf' },
  ],
  '2022-reaplicacao': [{ pdf: '2022_D1_fix.pdf', render: '2022_D1.pdf', gb: 'GB_2022_D1.pdf' }, { pdf: '2022_D2_fix.pdf', render: '2022_D2.pdf', gb: 'GB_2022_D2.pdf' }],
  '2023-reaplicacao': [{ pdf: '2023_D1_fix.pdf', render: '2023_D1.pdf', gb: 'GB_2023_D1.pdf' }, { pdf: '2023_D2_fix.pdf', render: '2023_D2.pdf', gb: 'GB_2023_D2.pdf' }],
  '2024-reaplicacao': [{ pdf: '2024_D1_fix.pdf', render: '2024_D1.pdf', gb: 'GB_2024_D1.pdf' }, { pdf: '2024_D2_fix.pdf', render: '2024_D2.pdf', gb: 'GB_2024_D2.pdf' }],
  '2025-reaplicacao': [{ pdf: '2025_D5_fix.pdf', render: '2025_D5.pdf', gb: 'GB_2025_D5.pdf' }, { pdf: '2025_D6_fix.pdf', render: '2025_D6.pdf', gb: 'GB_2025_D6.pdf' }],
  2020: [{ pdf: 'R2020_D1_fix.pdf', render: 'R2020_D1.pdf', gb: 'GBR_2020_D1.pdf' }, { pdf: 'R2020_D2_fix.pdf', render: 'R2020_D2.pdf', gb: 'GBR_2020_D2.pdf' }],
  2009: [{ pdf: 'R2009_D1_fix.pdf', render: 'R2009_D1.pdf', gb: 'GBR_2009_D1.pdf' }, { pdf: 'R2009_D2_fix.pdf', render: 'R2009_D2.pdf', gb: 'GBR_2009_D2.pdf' }],
  2010: [{ pdf: 'R2010_D1_fix.pdf', render: 'R2010_D1.pdf', gb: 'GBR_2010_D1.pdf' }, { pdf: 'R2010_D2_fix.pdf', render: 'R2010_D2.pdf', gb: 'GBR_2010_D2.pdf' }],
  2011: [{ pdf: 'R2011_D1_fix.pdf', render: 'R2011_D1.pdf', gb: 'GBR_2011_D1.pdf' }, { pdf: 'R2011_D2_fix.pdf', render: 'R2011_D2.pdf', gb: 'GBR_2011_D2.pdf' }],
  2012: [{ pdf: 'R2012_D1_fix.pdf', render: 'R2012_D1.pdf', gb: 'GBR_2012_D1.pdf' }, { pdf: 'R2012_D2_fix.pdf', render: 'R2012_D2.pdf', gb: 'GBR_2012_D2.pdf' }],
  2013: [{ pdf: 'R2013_D1_fix.pdf', render: 'R2013_D1.pdf', gb: 'GBR_2013_D1.pdf' }, { pdf: 'R2013_D2_fix.pdf', render: 'R2013_D2.pdf', gb: 'GBR_2013_D2.pdf' }],
  2014: [{ pdf: 'R2014_D1_fix.pdf', render: 'R2014_D1.pdf', gb: 'GBR_2014_D1.pdf' }, { pdf: 'R2014_D2_fix.pdf', render: 'R2014_D2.pdf', gb: 'GBR_2014_D2.pdf' }],
  2015: [{ pdf: 'R2015_D1_fix.pdf', render: 'R2015_D1.pdf', gb: 'GBR_2015_D1.pdf' }, { pdf: 'R2015_D2_fix.pdf', render: 'R2015_D2.pdf', gb: 'GBR_2015_D2.pdf' }],
  2016: [{ pdf: 'R2016_D1_fix.pdf', render: 'R2016_D1.pdf', gb: 'GBR_2016_D1.pdf' }, { pdf: 'R2016_D2_fix.pdf', render: 'R2016_D2.pdf', gb: 'GBR_2016_D2.pdf' }],
  2017: [{ pdf: 'R2017_D1_fix.pdf', render: 'R2017_D1.pdf', gb: 'GBR_2017_D1.pdf' }, { pdf: 'R2017_D2_fix.pdf', render: 'R2017_D2.pdf', gb: 'GBR_2017_D2.pdf' }],
  2018: [{ pdf: 'R2018_D1_fix.pdf', render: 'R2018_D1.pdf', gb: 'GBR_2018_D1.pdf' }, { pdf: 'R2018_D2_fix.pdf', render: 'R2018_D2.pdf', gb: 'GBR_2018_D2.pdf' }],
  2019: [{ pdf: 'R2019_D1_fix.pdf', render: 'R2019_D1.pdf', gb: 'GBR_2019_D1.pdf' }, { pdf: 'R2019_D2_fix.pdf', render: 'R2019_D2.pdf', gb: 'GBR_2019_D2.pdf' }],
  2020: [{ pdf: 'R2020_D1_fix.pdf', render: 'R2020_D1.pdf', gb: 'GBR_2020_D1.pdf' }, { pdf: 'R2020_D2_fix.pdf', render: 'R2020_D2.pdf', gb: 'GBR_2020_D2.pdf' }],
  2021: [{ pdf: 'R2021_D1_fix.pdf', render: 'R2021_D1.pdf', gb: 'GBR_2021_D1.pdf' }, { pdf: 'R2021_D2_fix.pdf', render: 'R2021_D2.pdf', gb: 'GBR_2021_D2.pdf' }],
  2022: [{ pdf: 'R2022_D1_fix.pdf', render: 'R2022_D1.pdf', gb: 'GBR_2022_D1.pdf' }, { pdf: 'R2022_D2_fix.pdf', render: 'R2022_D2.pdf', gb: 'GBR_2022_D2.pdf' }],
  2023: [{ pdf: 'R2023_D1_fix.pdf', render: 'R2023_D1.pdf', gb: 'GBR_2023_D1.pdf' }, { pdf: 'R2023_D2_fix.pdf', render: 'R2023_D2.pdf', gb: 'GBR_2023_D2.pdf' }],
  2024: [{ pdf: 'R2024_D1_fix.pdf', render: 'R2024_D1.pdf', gb: 'GBR_2024_D1.pdf' }, { pdf: 'R2024_D2_fix.pdf', render: 'R2024_D2.pdf', gb: 'GBR_2024_D2.pdf' }],
  2025: [{ pdf: 'R2025_D1_fix.pdf', render: 'R2025_D1.pdf', gb: 'GBR_2025_D1.pdf' }, { pdf: 'R2025_D2_fix.pdf', render: 'R2025_D2.pdf', gb: 'GBR_2025_D2.pdf' }],
};

const corrompido = (s) => /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s || '');
// Resíduo de extração: área privada/replacement, mojibake, marcador de
// expoente que não virou texto, ou fórmula desmontada em letras soltas.
const PUA = /[\ue000-\uf8ff\ufffd]/;
const MOJIBAKE = /Ã[\u0080-\u00bf]|â€/;
const MARCADOR = /\^\(|_\([0-9+\-−–]{1,4}\)/;
const FORMULA_SOLTA = /(^|\s)\S\s\S\s\S\s\S\s\S(\s|$)/;
const lixoso = (q) => {
  const txt = [q.context, q.alternativesIntroduction, ...q.alternatives.map((a) => a.text)].filter(Boolean).join('\n');
  return PUA.test(txt) || MOJIBAKE.test(txt) || MARCADOR.test(txt) || q.alternatives.some((a) => FORMULA_SOLTA.test(a.text || ''));
};
const vazia = (a) => !(a.text || '').trim() && !a.file;
const norm = (s) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
function shingles(s) {
  const w = norm(s).split(' ').filter((x) => x.length >= 2);
  const out = new Set();
  for (let i = 0; i + 2 < w.length; i++) out.add(w.slice(i, i + 3).join(' '));
  return out;
}
/** Quanto do texto do dataset aparece no texto do PDF (0..1). */
function contencao(a, b) {
  if (!a.size) return 0;
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n / a.size;
}

// Só palavras que não existem em português: o comando da questão é sempre em
// português e puxaria a contagem.
const EN = new Set('the and of to is in that it you for are with this be on was your have will we they he she his her my our their what when which who an at by from or'.split(' '));
const ES = new Set('el los las y del una un es por con su sus lo al pero muy esta este hay cuando donde mas tambien entre sobre hasta desde porque ya yo'.split(' '));
/** Idioma de uma questão de língua estrangeira, olhando só o texto de apoio. */
function idioma(q) {
  const textos = q.blocos.filter((b) => b.text && !b.formula).map((b) => b.text);
  const apoio = textos.length > 1 ? textos.slice(0, -1).join(' ') : textos.join(' ');
  const ws = norm(apoio).split(' ');
  const en = ws.filter((w) => EN.has(w)).length;
  const es = ws.filter((w) => ES.has(w)).length;
  if (en === es) return null;
  return en > es ? 'ingles' : 'espanhol';
}



/** Área pela posição no caderno — mesma regra do import. */
function disciplinaPorNumero(ano, n) {
  const blocos =
    ano >= 2017
      ? ['linguagens', 'ciencias-humanas', 'ciencias-natureza', 'matematica']
      : ano === 2009
        ? ['ciencias-natureza', 'ciencias-humanas', 'linguagens', 'matematica']
        : ['ciencias-humanas', 'ciencias-natureza', 'linguagens', 'matematica'];
  return blocos[Math.floor((n - 1) / 45)];
}
const anoDaProva = (slug) => parseInt(String(slug), 10);

const relatorio = { exames: {}, pendencias: [], divergenciasGabarito: [] };

for (const [slug, dias] of Object.entries(EXAMS)) {
  if (ONLY && !ONLY.includes(slug)) continue;
  const qdir = join(root, slug, 'questions');
  const dirs = readdirSync(qdir);
  const dataset = new Map(dirs.map((d) => [d, JSON.parse(readFileSync(join(qdir, d, 'details.json'), 'utf8'))]));
  const alvo = [...dataset].filter(
    ([, q]) =>
      corrompido(q.context) ||
      corrompido(q.alternativesIntroduction) ||
      q.alternatives.some((a) => vazia(a) || corrompido(a.text)) ||
      lixoso(q),
  );
  // Números que nem existem no dataset: são criados do zero.
  const temNum = new Set(dirs.map((d) => parseInt(d, 10)).filter((n) => !isNaN(n)));
  const ausentes = [];
  for (let n = 1; n <= 180; n++) {
    if (temNum.has(n)) continue;
    if (n <= 5 && dirs.includes(n + '-ingles')) continue;
    ausentes.push([String(n), null]);
  }
  alvo.push(...ausentes);
  const rel = { alvo: alvo.length, criadas: 0, ausentes: ausentes.map(([n]) => n).join(','), corrigidas: 0, texto: 0, imagensAlt: 0, imagensEnunciado: 0, modo: [] };
  relatorio.exames[slug] = rel;
  // Mesmo sem questão para refazer, a prova passa pela conferência de gabarito.

  // Questões do PDF, chaveadas como as pastas do dataset ("12", "3-ingles").
  const pdfQs = new Map();
  const origem = new Map();
  for (const dia of dias) {
    const r = await parsePdf(join(pdfDir, dia.pdf));
    const gab = await lerGabarito(dia.gb, dias.indexOf(dia) === 0 ? 1 : 7);
    const vistos = new Map();
    for (const q of r.questoes) {
      let chave = String(q.number);
      if (q.number <= 5 && q.number >= 1 && dias.indexOf(dia) === 0) {
        // Idioma decidido por bloco (1ª e 2ª ocorrência de 1..5), ver abaixo.
        const vez = (vistos.get(q.number) ?? 0) + 1;
        vistos.set(q.number, vez);
        chave = `${q.number}-#${vez}`;
      }
      if (pdfQs.has(chave)) continue;
      q.dia = dia;
      q.gabRaw = gab?.get(q.number);
      q.gab = q.gabRaw;
      q.sh = shingles(q.body + ' ' + q.alternatives.map((a) => a.text).join(' '));
      pdfQs.set(chave, q);
      origem.set(chave, dia);
    }
  }
  // O bloco de LE que tem mais cara de inglês é o inglês; o outro, espanhol.
  {
    const voto = { 1: 0, 2: 0 };
    for (const [k, q] of pdfQs) {
      const m = /-#(\d)$/.exec(k);
      if (!m) continue;
      const l = idioma(q);
      voto[m[1]] += l === 'ingles' ? 1 : l === 'espanhol' ? -1 : 0;
    }
    const primeiroIngles = voto[1] >= voto[2];
    for (const k of [...pdfQs.keys()]) {
      const m = /^(\d)-#(\d)$/.exec(k);
      if (!m) continue;
      const lang = (m[2] === '1') === primeiroIngles ? 'ingles' : 'espanhol';
      const q = pdfQs.get(k);
      pdfQs.delete(k);
      const g = q.gabRaw;
      q.gab = g && typeof g === 'object' ? g[lang] : g;
      pdfQs.set(`${m[1]}-${lang}`, q);
    }
  }

  // A numeração do caderno bate com a do dataset? Mede nas questões íntegras.
  const integras = [...dataset].filter(([, q]) => !corrompido(q.context) && norm(q.context + ' ' + q.alternativesIntroduction).length > 80);
  let bate = 0, testadas = 0;
  for (const [d, q] of integras) {
    const p = pdfQs.get(d);
    if (!p) continue;
    testadas++;
    if (contencao(shingles(q.context + ' ' + q.alternativesIntroduction), p.sh) > 0.5) bate++;
  }
  // Segunda prova da numeração: o gabarito do dataset contra o oficial, número a número.
  let gabBate = 0, gabTestadas = 0;
  for (const [d, q] of dataset) {
    if (/-(ingles|espanhol)$/.test(d)) continue;
    const p = pdfQs.get(d);
    if (!p?.gab || p.gab === 'ANULADA' || typeof p.gab === 'object') continue;
    gabTestadas++;
    if (p.gab === q.correctAlternative) gabBate++;
    else if (process.env.DEBUG_GAB) console.log('  [gab]', slug, d, 'dataset=' + q.correctAlternative, 'oficial=' + p.gab, 'Q' + p.number);
  }
  // 90% separa os dois casos: coluna errada do gabarito fica perto de 50%,
  // enquanto erro pontual do dataset (poucas questões) fica acima de 95%.
  const gabConfiavel = gabTestadas > 50 && gabBate / gabTestadas >= 0.9;
  if (!gabConfiavel) for (const [, p] of pdfQs) p.gab = null;
  const porNumero = (testadas > 20 && bate / testadas > 0.7) || (gabTestadas > 100 && gabBate / gabTestadas > 0.9);
  rel.modo.push(`texto ${bate}/${testadas}, gabarito ${gabBate}/${gabTestadas}${gabConfiavel ? '' : ' (ignorado)'} → ${porNumero ? 'por número' : 'por conteúdo'}`);

  for (const [d, q] of alvo) {
    const criar = q === null;
    const textoRuim = criar || corrompido(q.context) || corrompido(q.alternativesIntroduction) || !norm((q.context || '') + (q.alternativesIntroduction || ''));
    // Comando que é lixo de extração ("B E") também pede o enunciado do caderno.
    const comandoRuim = !criar && norm(q.alternativesIntroduction).replace(/ /g, '').length < 8;
    let p = null;
    const shD = criar ? new Set() : shingles((q.context || '') + ' ' + (q.alternativesIntroduction || ''));
    if (!textoRuim) {
      // Confere pelo conteúdo, mesmo no modo por número.
      let melhor = null, nota = 0;
      for (const [k, cand] of pdfQs) {
        const s = contencao(shD, cand.sh);
        if (s > nota) { nota = s; melhor = k; }
      }
      if (nota >= 0.35) p = pdfQs.get(melhor);
      else if (porNumero && pdfQs.get(d) && (shD.size < 8 || contencao(shD, pdfQs.get(d).sh) >= 0.2 || pdfQs.get(d).gab === q.correctAlternative)) p = pdfQs.get(d);
    } else if (porNumero) {
      p = pdfQs.get(d);
    }
    if (!p) { relatorio.pendencias.push(`${slug}/${d}: não achei a questão no caderno`); continue; }
    if (p.alternatives.length !== 5) { relatorio.pendencias.push(`${slug}/${d}: caderno com ${p.alternatives.length} alternativas (Q${p.number})`); continue; }

    // Gabarito: o do dataset, conferido com o oficial.
    let correta = criar ? p.gab : q.correctAlternative;
    if (criar && !correta) { relatorio.pendencias.push(`${slug}/${d}: questão ausente, mas sem gabarito oficial confiável`); continue; }
    if (p.gab === 'ANULADA') { relatorio.pendencias.push(`${slug}/${d}: questão anulada no gabarito oficial`); continue; }
    if (!criar && p.gab && typeof p.gab === 'string' && p.gab !== correta) {
      relatorio.divergenciasGabarito.push(`${slug}/${d}: dataset=${correta} oficial=${p.gab} (Q${p.number} ${p.dia.gb})`);
      correta = p.gab;
    }
    if (!/^[A-E]$/.test(correta || '')) { relatorio.pendencias.push(`${slug}/${d}: sem gabarito`); continue; }

    const renderFile = p.dia.render ?? p.dia.pdf;
    const doc = { file: join(pdfDir, renderFile) };
    const pasta = join(qdir, d);
    if (criar && !DRY) mkdirSync(pasta, { recursive: true });
    const novosArquivos = [];
    const pendentesGravar = [];
    const salvar = async (pag, caixa, pad = 3) => {
      const nome = `${randomUUID()}.png`;
      const png = await cropPng(doc, pag, caixa, pad);
      pendentesGravar.push([join(pasta, nome), png]);
      const url = `https://enem.dev/${slug}/questions/${d}/${nome}`;
      novosArquivos.push(url);
      return url;
    };

    // Alternativas: todas do caderno (misturar com as do dataset trocaria ordem/estilo).
    const alternatives = [];
    let foraDoPadrao = false;
    for (const a of p.alternatives) {
      const imagem = a.faixa || a.fracao || a.figs.length > 0 || !a.text;
      if (!imagem) {
        alternatives.push({ letter: a.letter, text: a.text, file: null, isCorrect: a.letter === correta });
        rel.texto++;
        continue;
      }
      const b = a.box;
      const caixa = a.faixa ?? {
        x0: Math.min(b.xTexto - 2, ...a.figs.map((f) => f.x0)),
        x1: Math.max(b.x1, ...a.figs.map((f) => f.x1)),
        y0: Math.min(b.yBot, ...a.figs.map((f) => f.y0)),
        y1: Math.max(b.yTop + (a.fracao ? 2 : 0), ...a.figs.map((f) => f.y1)),
      };
      const pag = a.faixa?.p ?? a.figs[0]?.p ?? b.p;
      const url = await salvar(pag, caixa);
      alternatives.push({ letter: a.letter, text: null, file: url, isCorrect: a.letter === correta });
      if (caixa.y1 - caixa.y0 > 260 || caixa.x1 - caixa.x0 > p.alternatives[0].box.w / 2 + 10) foraDoPadrao = true;
      rel.imagensAlt++;
    }

    if (foraDoPadrao) { relatorio.pendencias.push(`${slug}/${d}: diagramação fora do padrão (Q${p.number}), não gravada`); continue; }
    const base = criar
      ? { title: `Questão ${p.number} - ENEM ${anoDaProva(slug)}`, index: p.number, year: anoDaProva(slug), language: null, discipline: disciplinaPorNumero(anoDaProva(slug), p.number), context: null, files: [], correctAlternative: correta, alternativesIntroduction: null }
      : q;
    const novo = { ...base, correctAlternative: correta, alternatives };
    // O caderno tem figura no enunciado e o dataset não trouxe nenhuma: refaz.
    const semFigura = !criar && p.blocos.some((bl) => bl.fig && !bl.formula) && !(q.files ?? []).length && !/!\[/.test(q.context || '');
    if (textoRuim || comandoRuim || semFigura) {
      // Enunciado refeito: parágrafos + figuras; o último parágrafo é o comando.
      const partes = [];
      const files = [];
      for (const bl of p.blocos) {
        if (bl.fig) {
          const url = await salvar(bl.fig.p, bl.fig, bl.formula ? 2 : 4);
          files.push(url);
          partes.push(`![](${url})`);
          rel.imagensEnunciado++;
        } else partes.push(bl.text);
      }
      let intro = null;
      if (partes.length > 1 && !partes[partes.length - 1].startsWith('![')) intro = partes.pop();
      else if (partes.length === 1) intro = partes.pop();
      novo.context = partes.join('\n\n') || null;
      novo.alternativesIntroduction = intro;
      novo.files = files;
    }
    novo.files = [...new Set([...(novo.files ?? []), ...alternatives.map((a) => a.file).filter(Boolean)])];
    // Grava só no fim: questão pulada (fora do padrão) não deixa imagem órfã.
    if (!DRY) {
      for (const [arq, png] of pendentesGravar) writeFileSync(arq, png);
      writeFileSync(join(pasta, 'details.json'), JSON.stringify(novo, null, 4) + '\n');
    }
    if (criar) rel.criadas++;
    else rel.corrigidas++;
    relatorio.feitas ??= [];
    relatorio.feitas.push({ slug, d, pdfQ: p.number, pdf: p.dia.pdf, textoRefeito: textoRuim, alternativas: alternatives.map((a) => (a.file ? 'img' : 'txt')).join('') });
  }
  // Segunda passada: nas questões íntegras, só o gabarito contra o oficial.
  // Exige texto claramente igual ao do caderno, para não trocar gabarito de
  // questão casada errado.
  const alvos = new Set(alvo.map(([d]) => d));
  rel.gabaritosCorrigidos = 0;
  for (const [d, q] of dataset) {
    if (alvos.has(d)) continue;
    const p = pdfQs.get(d);
    if (!p?.gab || typeof p.gab !== 'string' || p.gab === 'ANULADA' || p.gab === q.correctAlternative) continue;
    if (contencao(shingles((q.context || '') + ' ' + (q.alternativesIntroduction || '')), p.sh) < 0.5) continue;
    relatorio.divergenciasGabarito.push(`${slug}/${d}: dataset=${q.correctAlternative} oficial=${p.gab} (Q${p.number}, só gabarito)`);
    const novo = { ...q, correctAlternative: p.gab, alternatives: q.alternatives.map((a) => ({ ...a, isCorrect: a.letter === p.gab })) };
    if (!DRY) writeFileSync(join(qdir, d, 'details.json'), JSON.stringify(novo, null, 4) + '\n');
    rel.gabaritosCorrigidos++;
  }
  console.log(slug, JSON.stringify(rel));
}
writeFileSync(join(pdfDir, '..', `relatorio${DRY ? '-dry' : ''}.json`), JSON.stringify(relatorio, null, 1));
console.log('pendências:', relatorio.pendencias.length);
for (const x of relatorio.pendencias) console.log('  ', x);
console.log('divergências de gabarito:', relatorio.divergenciasGabarito.length);
for (const x of relatorio.divergenciasGabarito.slice(0, 40)) console.log('  ', x);
