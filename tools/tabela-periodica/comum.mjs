// Leitores das fontes primárias da tabela periódica. Cada função recebe o
// arquivo como foi baixado (por `baixar.mjs`, em `fontes/`) e devolve só o que
// interessa, sem arredondar nada: valores com incerteza seguem como texto
// ("157.249(2)"), para a tela mostrar os mesmos algarismos da fonte.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const AQUI = fileURLToPath(new URL('.', import.meta.url));
export const PASTA_FONTES = join(AQUI, 'fontes');
export const SAIDA = join(AQUI, '..', '..', 'openem_frontend', 'src', 'data', 'elementos.json');

/**
 * As fontes, na ordem em que o roteiro as usa. `arquivo` é o nome em
 * `fontes/`; `url` é o que `baixar.mjs` busca e o que a ficha linka.
 */
export const FONTES = {
  'ciaaw-padrao': {
    nome: 'CIAAW/IUPAC, Standard Atomic Weights 2024',
    url: 'https://www.ciaaw.org/atomic-weights.htm',
    arquivo: 'ciaaw-padrao.html',
  },
  'ciaaw-abreviado': {
    nome: 'CIAAW/IUPAC, Abridged Standard Atomic Weights 2024',
    url: 'https://www.ciaaw.org/abridged-atomic-weights.htm',
    arquivo: 'ciaaw-abreviado.html',
  },
  'ciaaw-radioativos': {
    nome: 'CIAAW/IUPAC, Radioactive Elements',
    url: 'https://www.ciaaw.org/radioactive-elements.htm',
    arquivo: 'ciaaw-radioativos.html',
  },
  'nist-asd': {
    nome: 'NIST Atomic Spectra Database, Ionization Energies',
    url: 'https://physics.nist.gov/cgi-bin/ASD/ie.pl?spectra=H-Og+I&units=1&format=2&order=0&at_num_out=on&sp_name_out=on&ion_charge_out=on&el_name_out=on&seq_out=on&shells_out=on&conf_out=on&level_out=on&ion_conf_out=on&e_out=0&unc_out=on&biblio=on&submit=Retrieve+Data',
    pagina: 'https://physics.nist.gov/PhysRefData/ASD/ionEnergy.html',
    arquivo: 'nist-asd.csv',
  },
  'nist-composicao': {
    nome: 'NIST, Atomic Weights and Isotopic Compositions',
    url: 'https://physics.nist.gov/cgi-bin/Compositions/stand_alone.pl?ele=&all=all&ascii=ascii2&isotype=some',
    pagina: 'https://www.nist.gov/pml/atomic-weights-and-isotopic-compositions-relative-atomic-masses',
    arquivo: 'nist-composicao.txt',
  },
  pubchem: {
    nome: 'PubChem (NIH), Periodic Table of Elements',
    url: 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/periodictable/JSON',
    pagina: 'https://pubchem.ncbi.nlm.nih.gov/periodic-table/',
    arquivo: 'pubchem.json',
  },
  'iaea-livechart': {
    nome: 'IAEA Nuclear Data Services, LiveChart of Nuclides',
    url: 'https://nds.iaea.org/relnsd/v1/data?fields=ground_states&nuclides=all',
    pagina: 'https://www-nds.iaea.org/relnsd/vcharthtml/VChartHTML.html',
    arquivo: 'iaea-livechart.csv',
  },
  mendeleev: {
    nome: 'mendeleev 1.3.0 (MIT), dados compilados por L. M. Mentel',
    url: 'https://raw.githubusercontent.com/lmmentel/mendeleev/v1.3.0/mendeleev/elements.db',
    pagina: 'https://mendeleev.readthedocs.io/',
    arquivo: 'mendeleev.db',
  },
  'tabelaperiodica-org': {
    nome: 'tabelaperiodica.org, lista de elementos em português do Brasil',
    url: 'https://www.tabelaperiodica.org/',
    arquivo: 'tabelaperiodica-org.html',
  },
};

/** Fontes que não são baixadas: são citadas pelo roteiro (ver `nomes.json`). */
export const FONTES_CITADAS = {
  'fapesp-2016': {
    nome: 'Revista Pesquisa FAPESP, "Escolhidos os nomes dos novos elementos da tabela periódica" (10/jun/2016)',
    url: 'https://revistapesquisa.fapesp.br/escolhidos-os-nomes-dos-novos-elementos-da-tabela-periodica-2/',
  },
  'pyykko-2009': {
    nome: 'P. Pyykkö e M. Atsumi, Molecular Single-Bond Covalent Radii for Elements 1-118, Chem. Eur. J. 15, 186 (2009), via mendeleev',
    url: 'https://doi.org/10.1002/chem.200800987',
  },
  'andersen-2004': {
    nome: 'T. Andersen, Atomic negative ions: structure, dynamics and collisions, Physics Reports 394, 157 (2004)',
    url: 'https://doi.org/10.1016/j.physrep.2004.01.001',
  },
  'leimbach-2020': {
    nome: 'D. Leimbach et al., The electron affinity of astatine, Nature Communications 11, 3824 (2020)',
    url: 'https://doi.org/10.1038/s41467-020-17599-2',
  },
  'iupac-2022': {
    nome: 'IUPAC, Periodic Table of the Elements (versão de 4/mai/2022)',
    url: 'https://iupac.org/what-we-do/periodic-table-of-elements/',
  },
  openem: {
    nome: 'OpENEM (texto próprio ou valor derivado pelo roteiro)',
    url: 'https://github.com/migueldsants/OpENEM/tree/main/tools/tabela-periodica',
  },
};

export function lerFonte(id, encoding = 'utf8') {
  return readFileSync(join(PASTA_FONTES, FONTES[id].arquivo), encoding);
}

/** Texto de uma célula de HTML: sem tags, entidades trocadas, sem espaços. */
function textoCelula(html) {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;?/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&plusmn;/g, '±')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function linhasDeTabela(html) {
  const linhas = [];
  for (const m of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const celulas = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => textoCelula(c[1]));
    if (celulas.length) linhas.push(celulas);
  }
  return linhas;
}

/**
 * "4.002602(2)" → { valor: "4.002602", incerteza: "0.000002" }. A incerteza
 * entre parênteses vale nos últimos algarismos do valor.
 */
export function valorComIncerteza(texto) {
  const m = /^(\d+(?:\.\d+)?)\((\d+(?:\.\d+)?)\)$/.exec(texto.replace(/\s/g, ''));
  if (!m) return null;
  const [, valor, inc] = m;
  const casas = (valor.split('.')[1] ?? '').length;
  if (inc.includes('.')) return { valor, incerteza: inc };
  return { valor, incerteza: (Number(inc) / 10 ** casas).toFixed(casas) };
}

/** Tabela de pesos atômicos padrão: z → { simbolo, nomeEn, padrao, notas }. */
export function lerCiaawPadrao() {
  const out = new Map();
  for (const c of linhasDeTabela(lerFonte('ciaaw-padrao'))) {
    if (c.length < 5 || !/^\d+$/.test(c[0])) continue;
    const z = Number(c[0]);
    const bruto = c[3].replace(/\s/g, '');
    let padrao = null;
    const intervalo = /^\[([\d.]+),([\d.]+)\]$/.exec(bruto);
    if (intervalo) padrao = { intervalo: [intervalo[1], intervalo[2]] };
    else if (bruto !== '—') {
      padrao = valorComIncerteza(bruto);
      if (!padrao) throw new Error(`CIAAW: peso de ${z} ilegível: ${bruto}`);
    }
    out.set(z, {
      simbolo: c[1],
      nomeEn: c[2],
      padrao,
      notas: c[4].split(' ').filter(Boolean),
    });
  }
  return out;
}

/** Tabela abreviada: z → { valor, incerteza } ou null (sem peso padrão). */
export function lerCiaawAbreviado() {
  const out = new Map();
  for (const c of linhasDeTabela(lerFonte('ciaaw-abreviado'))) {
    if (c.length < 4 || !/^\d+$/.test(c[0])) continue;
    const bruto = c[3].replace(/\s/g, '');
    if (bruto === '—') {
      out.set(Number(c[0]), null);
      continue;
    }
    const [valor, incerteza] = bruto.split('±');
    if (!valor || !incerteza) throw new Error(`CIAAW abreviado ilegível: ${c.join(' | ')}`);
    out.set(Number(c[0]), { valor, incerteza });
  }
  return out;
}

/**
 * "4.21(16) Ma" → { valor, incerteza, unidade }; "approx. 4 h" → aproximado.
 */
export function meiaVida(texto) {
  const t = texto.trim();
  const aprox = /^approx\.\s*([\d.]+)\s*(\S+)$/.exec(t);
  if (aprox) return { valor: aprox[1], incerteza: null, unidade: aprox[2], aproximado: true };
  const m = /^([\d.]+)\(([\d.]+)\)\s*(\S+)$/.exec(t);
  if (!m) throw new Error(`meia-vida ilegível: ${texto}`);
  const casas = (m[1].split('.')[1] ?? '').length;
  const incerteza = m[2].includes('.') ? m[2] : (Number(m[2]) / 10 ** casas).toFixed(casas);
  return { valor: m[1], incerteza, unidade: m[3] };
}

/**
 * Elementos sem isótopo estável e sem peso padrão: z → isótopo de vida mais
 * longa (o primeiro listado quando a CIAAW dá dois igualmente estáveis).
 */
export function lerCiaawRadioativos() {
  const out = new Map();
  for (const c of linhasDeTabela(lerFonte('ciaaw-radioativos'))) {
    if (c.length !== 5 || !/^\d+$/.test(c[0])) continue;
    const z = Number(c[0]);
    if (out.has(z)) continue;
    out.set(z, { numeroMassa: Number(c[3]), meiaVida: meiaVida(c[4]) });
  }
  return out;
}

/** Linha de CSV do NIST: os campos vêm como ="valor". */
function camposNist(linha) {
  const campos = [];
  for (const m of linha.matchAll(/"=""(.*?)"""/g)) campos.push(m[1]);
  return campos;
}

/** Cernes que o NIST usa na coluna "Ground Shells". */
const CERNES_NIST = {
  '[Ne]': '1s2.2s2.2p6',
  '[Ar]': '1s2.2s2.2p6.3s2.3p6',
  '[Kr]': '1s2.2s2.2p6.3s2.3p6.3d10.4s2.4p6',
  '[Cd]': '1s2.2s2.2p6.3s2.3p6.3d10.4s2.4p6.4d10.5s2',
  '[Xe]': '1s2.2s2.2p6.3s2.3p6.3d10.4s2.4p6.4d10.5s2.5p6',
  '[Hg]': '1s2.2s2.2p6.3s2.3p6.3d10.4s2.4p6.4d10.5s2.5p6.4f14.5d10.6s2',
  '[Rn]': '1s2.2s2.2p6.3s2.3p6.3d10.4s2.4p6.4d10.5s2.5p6.4f14.5d10.6s2.6p6',
};

/** "[Ne].3s" → ["1s2","2s2","2p6","3s1"]: subníveis com a contagem explícita. */
export function subniveisNist(shells) {
  let t = shells;
  for (const [cerne, exp] of Object.entries(CERNES_NIST)) t = t.replace(cerne, exp);
  return t
    .split('.')
    .filter(Boolean)
    .map((s) => {
      const m = /^(\d)([spdf])(\d*)$/.exec(s);
      if (!m) throw new Error(`subnível do NIST ilegível: ${s} (${shells})`);
      return `${m[1]}${m[2]}${m[3] || '1'}`;
    });
}

/**
 * Energias de ionização dos átomos neutros: z → { subniveis, ev, incerteza,
 * tipo }. O NIST marca o valor teórico (calculado) com parênteses e o
 * semiempírico com colchetes; a tela diz qual é qual.
 */
export function lerNistAsd() {
  const out = new Map();
  const linhas = lerFonte('nist-asd').split(/\r?\n/).slice(1);
  for (const linha of linhas) {
    const c = camposNist(linha);
    if (c.length < 13 || !/^\d+$/.test(c[0])) continue;
    const z = Number(c[0]);
    const prefixo = c[9];
    out.set(z, {
      subniveis: subniveisNist(c[5]),
      ev: c[10] || null,
      incerteza: c[12] || null,
      tipo: prefixo === '(' ? 'teorica' : prefixo === '[' ? 'semiempirica' : 'medida',
    });
  }
  return out;
}

/**
 * Composição isotópica: z → { isotopos: [{ a, abundancia }], padrao }. Só os
 * isótopos com abundância natural (a coluna vazia é isótopo sintético).
 */
export function lerNistComposicao() {
  const texto = lerFonte('nist-composicao').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
  const out = new Map();
  for (const bloco of texto.split(/\n\s*\n/)) {
    const campo = (nome) => new RegExp(`${nome} = (.*)`).exec(bloco)?.[1]?.trim() ?? '';
    const z = Number(campo('Atomic Number'));
    if (!z) continue;
    if (!out.has(z)) out.set(z, { isotopos: [], padrao: campo('Standard Atomic Weight') });
    const abundancia = campo('Isotopic Composition');
    if (abundancia) {
      out.get(z).isotopos.push({ a: Number(campo('Mass Number')), abundancia });
    }
  }
  return out;
}

/** Tabela do PubChem: z → objeto com as colunas pelo nome. */
export function lerPubchem() {
  const d = JSON.parse(lerFonte('pubchem'));
  const colunas = d.Table.Columns.Column;
  const out = new Map();
  for (const r of d.Table.Row) {
    const o = Object.fromEntries(colunas.map((c, i) => [c, r.Cell[i] ?? '']));
    out.set(Number(o.AtomicNumber), o);
  }
  return out;
}

/** CSV simples (sem aspas com vírgula dentro: é o caso da IAEA). */
export function lerCsv(texto) {
  const [cab, ...linhas] = texto.split(/\r?\n/).filter(Boolean);
  const nomes = cab.split(',');
  return linhas.map((l) => Object.fromEntries(l.split(',').map((v, i) => [nomes[i], v])));
}

/**
 * Nuclídeos no estado fundamental (IAEA): z → { estavel, isotopos: [{ a,
 * abundancia, meiaVidaSeg, meiaVida }] }.
 */
export function lerIaea() {
  const out = new Map();
  for (const r of lerCsv(lerFonte('iaea-livechart'))) {
    const z = Number(r.z);
    if (!z) continue;
    if (!out.has(z)) out.set(z, { estavel: false, isotopos: [] });
    const e = out.get(z);
    const a = z + Number(r.n);
    if (r.half_life === 'STABLE') e.estavel = true;
    e.isotopos.push({
      a,
      abundancia: r.abundance ? Number(r.abundance) : null,
      estavel: r.half_life === 'STABLE',
      meiaVidaSeg: r.half_life_sec ? Number(r.half_life_sec) : null,
      meiaVida: r.half_life && r.half_life !== 'STABLE'
        ? { valor: r.half_life, incerteza: r.unc_hl || null, unidade: r.unit_hl }
        : null,
      operador: r.operator_hl || null,
    });
  }
  return out;
}

/** Banco SQLite do mendeleev (segunda fonte). Requer Node ≥ 22.13. */
export async function abrirMendeleev() {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(join(PASTA_FONTES, FONTES.mendeleev.arquivo), { readOnly: true });
  const elementos = new Map(
    db.prepare('select * from elements').all().map((r) => [r.atomic_number, { ...r }]),
  );
  const oxidacao = new Map();
  for (const r of db.prepare('select atomic_number, oxidation_state, category from oxidationstates').all()) {
    if (!oxidacao.has(r.atomic_number)) oxidacao.set(r.atomic_number, { main: [], extended: [] });
    oxidacao.get(r.atomic_number)[r.category === 'main' ? 'main' : 'extended'].push(r.oxidation_state);
  }
  const fases = new Map();
  for (const r of db.prepare('select * from phasetransitions').all()) {
    // Com alótropos, a primeira linha é a forma mais comum (C grafite, P branco).
    if (!fases.has(r.atomic_number)) fases.set(r.atomic_number, { ...r });
  }
  const series = new Map(db.prepare('select id, name from series').all().map((r) => [r.id, r.name]));
  db.close();
  return { elementos, oxidacao, fases, series };
}

/**
 * Nomes da tabela do tabelaperiodica.org: z → { nome, simbolo }. Cada casa da
 * tabela traz no título "Ferro (Fe) — Número atômico 26, bloco d".
 */
export function lerNomesTabelaPeriodicaOrg() {
  const html = lerFonte('tabelaperiodica-org');
  const out = new Map();
  for (const m of html.matchAll(/([\p{L}]+) \(([A-Z][a-z]{0,2})\) — Número atômico (\d+)/gu)) {
    out.set(Number(m[3]), { nome: m[1], simbolo: m[2] });
  }
  return out;
}

/** Minúsculas e sem acento, para comparar nomes. */
export function semAcento(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Configuração escrita como no PubChem/mendeleev ("[Ar] 3d6 4s2", "1s",
 * "[Rn]7s2 5f14 6d7 (calculated)") → subníveis com contagem.
 */
const CERNES_GAS_NOBRE = {
  '[He]': ['1s2'],
  '[Ne]': ['1s2', '2s2', '2p6'],
  '[Ar]': ['1s2', '2s2', '2p6', '3s2', '3p6'],
  '[Kr]': ['1s2', '2s2', '2p6', '3s2', '3p6', '3d10', '4s2', '4p6'],
  '[Xe]': ['1s2', '2s2', '2p6', '3s2', '3p6', '3d10', '4s2', '4p6', '4d10', '5s2', '5p6'],
  '[Rn]': ['1s2', '2s2', '2p6', '3s2', '3p6', '3d10', '4s2', '4p6', '4d10', '5s2', '5p6', '4f14', '5d10', '6s2', '6p6'],
};

export function subniveisTexto(texto) {
  const limpo = texto.replace(/\(.*?\)/g, '').trim();
  const cerne = /^\[(\w+)\]/.exec(limpo);
  const base = cerne ? CERNES_GAS_NOBRE[`[${cerne[1]}]`] : [];
  if (cerne && !base) throw new Error(`cerne desconhecido: ${texto}`);
  const resto = cerne ? limpo.slice(cerne[0].length) : limpo;
  const extra = [...resto.matchAll(/(\d)([spdf])(\d*)/g)].map((m) => `${m[1]}${m[2]}${m[3] || '1'}`);
  return [...base, ...extra];
}

/** Compara duas configurações pela contagem de cada subnível (sem ordem). */
export function mesmaConfiguracao(a, b) {
  const mapa = (l) => {
    const m = new Map();
    for (const s of l) {
      const [, sub, n] = /^(\d[spdf])(\d+)$/.exec(s);
      m.set(sub, (m.get(sub) ?? 0) + Number(n));
    }
    return m;
  };
  const ma = mapa(a);
  const mb = mapa(b);
  if (ma.size !== mb.size) return false;
  for (const [k, v] of ma) if (mb.get(k) !== v) return false;
  return true;
}
