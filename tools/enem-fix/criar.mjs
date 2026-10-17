// Cria do zero, a partir dos cadernos oficiais do INEP, provas que não existem
// no dataset (PPL antiga, 2ª/3ª aplicação, ENEM Digital...). Grava no mesmo
// formato do updated-enem-api: <slug>/details.json + questions/<n>/details.json.
//
// uso: node criar.mjs <dataset/public> <dir dos pdfs> [--dry] [--only=2016-ppl]
//                     [--saida=<dir>] [--comparar=<slug do dataset>]
//
// As provas e os cadernos estão em provas-novas.json. `--comparar` é a
// validação do próprio extrator: cria a prova a partir dos PDFs de uma prova
// que o dataset JÁ tem e mede, questão a questão, o quanto o resultado bate com
// ele (texto e gabarito). Use com `--saida` para não sobrescrever o dataset.
import './globals.mjs';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { parsePdf } from './parse.mjs';
import { cropPng } from './render.mjs';
import { lerGabarito } from './gabarito.mjs';
import { norm, shingles, contencao, idioma, areaPorNumero, DISCIPLINAS, IDIOMAS, lixoso } from './comum.mjs';

const [root, pdfDir, ...flags] = process.argv.slice(2);
const DRY = flags.includes('--dry');
const ONLY = flags.find((f) => f.startsWith('--only='))?.slice(7).split(',');
const SAIDA = flags.find((f) => f.startsWith('--saida='))?.slice(8) ?? root;
const COMPARAR = flags.find((f) => f.startsWith('--comparar='))?.slice(11);
if (!root || !pdfDir) {
  console.error('uso: node criar.mjs <dataset/public> <dir dos pdfs> [--dry] [--only=slug] [--saida=dir] [--comparar=slug]');
  process.exit(1);
}

const PROVAS = JSON.parse(readFileSync(new URL('./provas-novas.json', import.meta.url), 'utf8'));

/** Lê as questões de todos os cadernos da prova, chaveadas como as pastas do dataset. */
async function questoesDaProva(cfg, rel) {
  const qs = new Map();
  for (const [i, dia] of cfg.dias.entries()) {
    const arquivo = join(pdfDir, dia.pdf);
    if (!existsSync(arquivo)) throw new Error(`caderno ausente: ${dia.pdf}`);
    const r = await parsePdf(arquivo);
    const gab = dia.gb && existsSync(join(pdfDir, dia.gb)) ? await lerGabarito(join(pdfDir, dia.gb), dia.caderno ?? null) : null;
    if (dia.gb && !gab) rel.avisos.push(`gabarito ausente: ${dia.gb}`);
    const vistos = new Map();
    for (const q of r.questoes) {
      if (q.number < 1 || q.number > cfg.questoes) continue;
      let chave = String(q.number);
      const le = cfg.lingua && cfg.lingua.includes(q.number);
      if (le) {
        if (dia.idioma) chave = `${q.number}-${dia.idioma}`;
        else {
          // Caderno com os dois idiomas: 1ª ocorrência e 2ª, decididas abaixo.
          const vez = (vistos.get(q.number) ?? 0) + 1;
          vistos.set(q.number, vez);
          chave = `${q.number}-#${vez}`;
        }
      }
      if (qs.has(chave)) continue;
      const g = gab?.get(q.number);
      q.gab = le && g && typeof g === 'object' ? (dia.idioma ? g[dia.idioma] : g) : g;
      q.dia = dia;
      qs.set(chave, q);
    }
  }
  // O bloco de língua estrangeira com mais cara de inglês é o inglês.
  const voto = { 1: 0, 2: 0 };
  for (const [k, q] of qs) {
    const m = /-#(\d)$/.exec(k);
    if (!m) continue;
    const l = idioma(q);
    voto[m[1]] += l === 'ingles' ? 1 : l === 'espanhol' ? -1 : 0;
  }
  const primeiroIngles = voto[1] >= voto[2];
  for (const k of [...qs.keys()]) {
    const m = /^(\d+)-#(\d)$/.exec(k);
    if (!m) continue;
    const lang = (m[2] === '1') === primeiroIngles ? 'ingles' : 'espanhol';
    const q = qs.get(k);
    qs.delete(k);
    q.gab = q.gab && typeof q.gab === 'object' ? q.gab[lang] : q.gab;
    qs.set(`${m[1]}-${lang}`, q);
  }
  return qs;
}

/** Monta o details.json de uma questão (e as imagens recortadas). null = pendência. */
async function montarQuestao(slug, cfg, chave, p, rel) {
  const [num, lang = null] = chave.split('-');
  const n = +num;
  if (p.alternatives.length !== 5) return rel.pendencias.push(`${slug}/${chave}: caderno com ${p.alternatives.length} alternativas`), null;
  const correta = p.gab;
  if (correta === 'ANULADA') return rel.pendencias.push(`${slug}/${chave}: anulada no gabarito oficial`), null;
  if (!/^[A-E]$/.test(correta || '')) return rel.pendencias.push(`${slug}/${chave}: sem gabarito oficial`), null;

  const doc = { file: join(pdfDir, p.dia.render ?? p.dia.pdf) };
  const imagens = [];
  const salvar = async (pag, caixa, pad = 3) => {
    const nome = `${randomUUID()}.png`;
    imagens.push([nome, await cropPng(doc, pag, caixa, pad)]);
    return `https://enem.dev/${slug}/questions/${chave}/${nome}`;
  };

  const alternatives = [];
  for (const a of p.alternatives) {
    const imagem = a.faixa || a.fracao || a.figs.length > 0 || !a.text;
    if (!imagem) {
      alternatives.push({ letter: a.letter, text: a.text, file: null, isCorrect: a.letter === correta });
      continue;
    }
    const b = a.box;
    const caixa = a.faixa ?? {
      x0: Math.min(b.xTexto - 2, ...a.figs.map((f) => f.x0)),
      x1: Math.max(b.x1, ...a.figs.map((f) => f.x1)),
      y0: Math.min(b.yBot, ...a.figs.map((f) => f.y0)),
      y1: Math.max(b.yTop + (a.fracao ? 2 : 0), ...a.figs.map((f) => f.y1)),
    };
    if (caixa.y1 - caixa.y0 > 260 || caixa.x1 - caixa.x0 > p.alternatives[0].box.w / 2 + 10)
      return rel.pendencias.push(`${slug}/${chave}: diagramação fora do padrão`), null;
    const url = await salvar(a.faixa?.p ?? a.figs[0]?.p ?? b.p, caixa);
    alternatives.push({ letter: a.letter, text: null, file: url, isCorrect: a.letter === correta });
  }

  // Enunciado: parágrafos e figuras; o último parágrafo de texto é o comando.
  const partes = [];
  const files = [];
  for (const bl of p.blocos) {
    if (bl.fig) {
      const url = await salvar(bl.fig.p, bl.fig, bl.formula ? 2 : 4);
      files.push(url);
      partes.push(`![](${url})`);
    } else partes.push(bl.text);
  }
  let intro = null;
  if (partes.length && !partes[partes.length - 1].startsWith('![')) intro = partes.pop();
  const q = {
    title: `Questão ${n} - ${cfg.titulo}`,
    index: n,
    year: cfg.ano,
    language: lang,
    discipline: areaPorNumero(cfg, n),
    context: partes.join('\n\n') || null,
    files: [...new Set([...files, ...alternatives.map((a) => a.file).filter(Boolean)])],
    correctAlternative: correta,
    alternativesIntroduction: intro,
    alternatives,
  };
  if (!q.context && !q.alternativesIntroduction) return rel.pendencias.push(`${slug}/${chave}: sem enunciado`), null;
  if (lixoso(q)) return rel.pendencias.push(`${slug}/${chave}: texto com resíduo de extração`), null;
  return { q, imagens };
}

function ordemChave(a, b) {
  const [na, la = ''] = a.split('-');
  const [nb, lb = ''] = b.split('-');
  return +na - +nb || la.localeCompare(lb);
}

const relatorio = {};
for (const [slug, cfg] of Object.entries(PROVAS)) {
  if (ONLY && !ONLY.includes(slug)) continue;
  // Entradas de validação (provas que o dataset já tem) só rodam pedidas por
  // nome, e nunca gravam por cima do dataset.
  if (cfg.validacao && (!ONLY || SAIDA === root)) {
    if (ONLY) console.log(slug, 'é de validação: rode com --saida=<outra pasta>');
    continue;
  }
  const rel = { criadas: 0, pendencias: [], avisos: [] };
  relatorio[slug] = rel;
  const qs = await questoesDaProva(cfg, rel);
  // Números que o caderno não trouxe (o parser não achou o "QUESTÃO NN").
  for (let n = 1; n <= cfg.questoes; n++) {
    const tem = cfg.lingua?.includes(n) ? ['ingles', 'espanhol'].some((l) => qs.has(`${n}-${l}`)) : qs.has(String(n));
    if (!tem) rel.pendencias.push(`${slug}/${n}: não achei no caderno`);
  }

  const destino = join(SAIDA, slug);
  const feitas = [];
  for (const chave of [...qs.keys()].sort(ordemChave)) {
    const r = await montarQuestao(slug, cfg, chave, qs.get(chave), rel);
    if (!r) continue;
    feitas.push([chave, r]);
  }
  if (!DRY) {
    if (existsSync(destino)) rmSync(destino, { recursive: true });
    for (const [chave, { q, imagens }] of feitas) {
      const pasta = join(destino, 'questions', chave);
      mkdirSync(pasta, { recursive: true });
      for (const [nome, png] of imagens) writeFileSync(join(pasta, nome), png);
      writeFileSync(join(pasta, 'details.json'), JSON.stringify(q, null, 4) + '\n');
    }
    const prova = {
      title: cfg.titulo,
      year: cfg.ano,
      disciplines: DISCIPLINAS,
      languages: cfg.lingua?.length ? IDIOMAS : [],
      questions: feitas.map(([, { q }]) => ({ title: q.title, index: q.index, discipline: q.discipline, language: q.language })),
    };
    mkdirSync(destino, { recursive: true });
    writeFileSync(join(destino, 'details.json'), JSON.stringify(prova, null, 4) + '\n');
  }
  rel.criadas = feitas.length;

  if (COMPARAR) {
    // Validação: a prova criada contra a mesma prova no dataset.
    const qdir = join(root, COMPARAR, 'questions');
    let texto = 0, gab = 0, alt = 0, n = 0;
    const ruins = [];
    for (const [chave, { q }] of feitas) {
      const f = join(qdir, chave, 'details.json');
      if (!existsSync(f)) continue;
      const d = JSON.parse(readFileSync(f, 'utf8'));
      n++;
      const shD = shingles((d.context || '') + ' ' + (d.alternativesIntroduction || ''));
      const shQ = shingles((q.context || '') + ' ' + (q.alternativesIntroduction || ''));
      const t = shD.size < 5 ? 1 : contencao(shD, shQ);
      if (t >= 0.6) texto++;
      else ruins.push(`${chave} texto ${t.toFixed(2)}`);
      if (d.correctAlternative === q.correctAlternative) gab++;
      else ruins.push(`${chave} gabarito dataset=${d.correctAlternative} criada=${q.correctAlternative}`);
      const altsIguais = q.alternatives.every((a, i) => a.file || !d.alternatives[i]?.text || norm(a.text) === norm(d.alternatives[i].text));
      if (altsIguais) alt++;
      else ruins.push(`${chave} alternativas`);
    }
    rel.comparacao = { questoes: n, texto: `${texto}/${n}`, gabarito: `${gab}/${n}`, alternativas: `${alt}/${n}`, exemplos: ruins.slice(0, 30) };
  }
  console.log(slug, JSON.stringify({ criadas: rel.criadas, pendencias: rel.pendencias.length, avisos: rel.avisos, comparacao: rel.comparacao }, null, 1));
  for (const x of rel.pendencias) console.log('   ', x);
}
if (!DRY) writeFileSync(join(pdfDir, '..', 'relatorio-criar.json'), JSON.stringify(relatorio, null, 1));
