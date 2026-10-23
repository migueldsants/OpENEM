// Monta o catálogo da tela Tabela periódica a partir das fontes baixadas por
// `baixar.mjs`. Nada aqui é digitado à mão, salvo o que está nas listas
// comentadas abaixo (cada uma com o motivo) e nos arquivos `nomes.json` e
// `quimica.json`. Cada campo de cada elemento grava a fonte de onde veio.
//
//   node tools/tabela-periodica/montar.mjs
//
// Depois rode `verificar.mjs`, que confere cada valor contra uma segunda fonte.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AQUI,
  FONTES,
  FONTES_CITADAS,
  PASTA_FONTES,
  SAIDA,
  abrirMendeleev,
  lerCiaawAbreviado,
  lerCiaawPadrao,
  lerCiaawRadioativos,
  lerIaea,
  lerNistAsd,
  lerNistComposicao,
  lerPubchem,
  subniveisTexto,
} from './comum.mjs';

const nomes = JSON.parse(readFileSync(join(AQUI, 'nomes.json'), 'utf8'));
const quimica = JSON.parse(readFileSync(join(AQUI, 'quimica.json'), 'utf8'));
const baixadoEm = JSON.parse(readFileSync(join(PASTA_FONTES, 'baixado-em.json'), 'utf8'));

const ciaaw = lerCiaawPadrao();
const abreviado = lerCiaawAbreviado();
const radioativos = lerCiaawRadioativos();
const nist = lerNistAsd();
const composicao = lerNistComposicao();
const pubchem = lerPubchem();
const iaea = lerIaea();
const mendeleev = await abrirMendeleev();

// ---------------------------------------------------------------------------
// Listas de exceção. Cada uma diz por que existe.

/**
 * Configurações sem medida: a partir do 104 vêm de cálculo (o NIST as lista
 * até o 108; do 109 em diante só o PubChem, marcadas "predicted"/"calculated").
 */
const CONFIGURACAO_PREVISTA_DESDE = 104;

/** Categoria (metal, gás nobre…) só prevista: nenhuma química medida em massa. */
const CATEGORIA_PREVISTA_DESDE = 109;

/**
 * Pontos de fusão/ebulição que a fonte dá como estimativa (nunca foram
 * medidos em amostra visível): At, Fr e os actinídeos do 100 ao 103.
 */
const FASE_ESTIMADA = new Set([85, 87, 100, 101, 102, 103]);

/**
 * Densidades que o mendeleev diz serem estimativas teóricas (anotação da
 * coluna `density`). Se o PubChem tiver valor para um deles, é o mesmo tipo
 * de estimativa e vai marcado.
 */
const DENSIDADE_ESTIMADA = new Set([85, 87, ...Array.from({ length: 20 }, (_, i) => 99 + i)]);

/**
 * Eletronegatividades de Pauling que são valores atribuídos por estimativa
 * (sem dado termoquímico): At, Fr e do Am ao Lr (todos "1,3").
 */
const ELETRONEGATIVIDADE_ESTIMADA = new Set([85, 87, 95, 96, 97, 98, 99, 100, 101, 102, 103]);

/**
 * Afinidades eletrônicas. A fonte é a CRC pelo mendeleev, que tem as medidas
 * recentes (o PubChem, segunda fonte, traz valores antigos: F 3,339 eV no
 * lugar de 3,401). Elementos que não formam ânion estável (afinidade negativa
 * ou nula, Andersen 2004) aparecem assim, e não como "desconhecido"; o
 * mendeleev dá a esses um valor negativo ou nenhum.
 */
const ANION_INSTAVEL = new Set([2, 4, 7, 10, 12, 18, 25, 30, 36, 48, 54, 80, 86]);

/**
 * Afinidades que são estimativas teóricas (Po, Fr, Ra, Ac e o Og, calculado)
 * e a do At, medida em 2020, que substitui a estimativa que as duas fontes
 * ainda trazem.
 */
const AFINIDADE_ESTIMADA = new Set([84, 87, 88, 89, 118]);
const AFINIDADE_MEDIDA = {
  85: { ev: 2.41578, fonte: 'leimbach-2020' },
};

/**
 * Fusão e ebulição a 1 atm. O hélio não solidifica a 1 atm (o ponto de fusão
 * do PubChem, 0,95 K, é sob 25 atm). Carbono e arsênio sublimam (o mendeleev,
 * pela CRC, marca o ponto como de sublimação): o ponto de fusão do PubChem é
 * sob pressão e não vale para a tela.
 */
const NAO_SOLIDIFICA = new Set([2]);

/** Raios de Pyykkö a partir do 104: calculados, sem dado experimental. */
const RAIO_CALCULADO_DESDE = 104;

/**
 * Natural: ocorre na Terra e é obtido dela. Tc e Pm existem só em traços
 * (fissão espontânea do urânio) e são produzidos artificialmente, como os
 * transurânicos (Np e Pu também têm traços em minério de urânio).
 */
const SINTETICOS_ABAIXO_DO_URANIO = new Set([43, 61]);

// ---------------------------------------------------------------------------

/** Começo de cada período (número atômico do primeiro elemento). */
const INICIO_PERIODO = [1, 3, 11, 19, 37, 55, 87, 119];

function posicao(z) {
  const periodo = INICIO_PERIODO.findIndex((ini, i) => z >= ini && z < INICIO_PERIODO[i + 1]) + 1;
  const k = z - INICIO_PERIODO[periodo - 1]; // 0 = primeiro do período
  let coluna;
  let linha = periodo;
  let serieF = false;
  if (periodo === 1) coluna = z === 1 ? 1 : 18;
  else if (periodo <= 3) coluna = k < 2 ? k + 1 : k + 11;
  else if (periodo <= 5) coluna = k + 1;
  else if (k < 2) coluna = k + 1;
  else if (k <= 16) {
    // Lantanídeos (57–71) e actinídeos (89–103): linhas 9 e 10 da grade,
    // abaixo do corpo, a partir da coluna 3 (o marcador fica no grupo 3).
    serieF = true;
    linha = periodo === 6 ? 9 : 10;
    coluna = k + 1;
  } else coluna = k - 13;
  const grupo = serieF ? 3 : coluna;
  const bloco = serieF ? 'f' : z === 2 || coluna <= 2 ? 's' : coluna >= 13 ? 'p' : 'd';
  return { periodo, grupo, bloco, linha, coluna, serieF };
}

const GRUPO_ANTIGO = {
  1: '1A', 2: '2A', 3: '3B', 4: '4B', 5: '5B', 6: '6B', 7: '7B', 8: '8B', 9: '8B', 10: '8B',
  11: '1B', 12: '2B', 13: '3A', 14: '4A', 15: '5A', 16: '6A', 17: '7A', 18: '8A',
};

const FAMILIA = {
  1: 'metais alcalinos',
  2: 'metais alcalino-terrosos',
  13: 'família do boro',
  14: 'família do carbono',
  15: 'família do nitrogênio',
  16: 'calcogênios',
  17: 'halogênios',
  18: 'gases nobres',
};

/** GroupBlock do PubChem → chave da categoria no app. */
const CATEGORIA = {
  'Alkali metal': 'alcalino',
  'Alkaline earth metal': 'alcalino-terroso',
  'Transition metal': 'transicao',
  Lanthanide: 'lantanideo',
  Actinide: 'actinideo',
  'Post-transition metal': 'pos-transicao',
  Metalloid: 'semimetal',
  Nonmetal: 'nao-metal',
  Halogen: 'halogenio',
  'Noble gas': 'gas-nobre',
};

const ESTADO = { Solid: 'solido', Liquid: 'liquido', Gas: 'gasoso' };

const ORDEM_L = { s: 0, p: 1, d: 2, f: 3 };

/** Subníveis em ordem geométrica (camada, depois s/p/d/f). */
function ordemGeometrica(subniveis) {
  return [...subniveis].sort((a, b) => a[0] - b[0] || ORDEM_L[a[1]] - ORDEM_L[b[1]]);
}

function numero(texto) {
  if (texto === '' || texto == null) return null;
  const n = Number(texto);
  if (!Number.isFinite(n)) throw new Error(`número ilegível: ${texto}`);
  return n;
}

function oxidacoes(texto) {
  return [...new Set(texto.split(',').map((s) => s.trim()).filter(Boolean).map(Number))]
    .filter(Number.isFinite)
    .sort((a, b) => b - a);
}

/** Mesma regra de `estadoNaTemperatura` (openem_frontend/src/lib/tabela-periodica). */
function estadoA(t, fusao, ebulicao, semFusao) {
  if (semFusao === 'sublima') return ebulicao ? (t < ebulicao.k ? 'solido' : 'gasoso') : null;
  if (semFusao === 'nao-solidifica') return ebulicao ? (t < ebulicao.k ? 'liquido' : 'gasoso') : null;
  if (!fusao) return null;
  if (t < fusao.k) return 'solido';
  if (!ebulicao) return null;
  return t < ebulicao.k ? 'liquido' : 'gasoso';
}

const elementos = [];

for (let z = 1; z <= 118; z++) {
  const c = ciaaw.get(z);
  const p = pubchem.get(z);
  const n = nomes[String(z)];
  const m = mendeleev.elementos.get(z);
  if (!c || !p || !n || !m) throw new Error(`faltam dados do elemento ${z}`);
  const fontes = {};
  const e = { z, simbolo: c.simbolo, nome: n.nome };
  fontes.simbolo = 'ciaaw-padrao';
  fontes.nome = n.fonte ?? 'tabelaperiodica-org';
  e.nomeEn = c.nomeEn;
  fontes.nomeEn = 'ciaaw-padrao';
  if (n.variantes) e.variantes = n.variantes;

  // Posição na tabela da IUPAC.
  const pos = posicao(z);
  Object.assign(e, {
    periodo: pos.periodo,
    grupo: pos.grupo,
    grupoAntigo: GRUPO_ANTIGO[pos.grupo],
    familia: !pos.serieF && FAMILIA[pos.grupo] && !(z === 1) ? FAMILIA[pos.grupo] : null,
    bloco: pos.bloco,
    linha: pos.linha,
    coluna: pos.coluna,
  });
  fontes.posicao = 'iupac-2022';

  const categoria = CATEGORIA[p.GroupBlock];
  if (!categoria) throw new Error(`categoria desconhecida: ${p.GroupBlock} (${z})`);
  e.categoria = categoria;
  if (z >= CATEGORIA_PREVISTA_DESDE) e.categoriaPrevista = true;
  fontes.categoria = 'pubchem';

  // Massa atômica.
  const massa = {};
  if (c.padrao) {
    massa.padrao = c.padrao;
    fontes.massa = 'ciaaw-padrao';
    const ab = abreviado.get(z);
    if (!ab) throw new Error(`sem peso abreviado: ${z}`);
    massa.abreviado = ab;
    fontes.abreviado = 'ciaaw-abreviado';
    if (c.notas.length) massa.notas = c.notas;
  }
  const rad = radioativos.get(z);
  const nuclideos = iaea.get(z);
  e.radioativo = !nuclideos.estavel;
  fontes.radioativo = 'iaea-livechart';
  if (rad) {
    massa.numeroMassa = rad.numeroMassa;
    fontes.massa = 'ciaaw-radioativos';
    e.isotopoMaisEstavel = { a: rad.numeroMassa, meiaVida: rad.meiaVida };
    fontes.isotopoMaisEstavel = 'ciaaw-radioativos';
  } else if (e.radioativo) {
    // Bi, Th, Pa, U: radioativos, mas com peso padrão; a CIAAW não os lista
    // entre os radioativos, então o isótopo de vida mais longa vem da IAEA.
    const maior = nuclideos.isotopos
      .filter((i) => i.meiaVidaSeg != null && i.operador == null)
      .sort((a, b) => b.meiaVidaSeg - a.meiaVidaSeg)[0];
    e.isotopoMaisEstavel = { a: maior.a, meiaVida: maior.meiaVida };
    fontes.isotopoMaisEstavel = 'iaea-livechart';
  }
  if (!massa.padrao && !massa.numeroMassa) throw new Error(`sem massa: ${z}`);
  e.massa = massa;

  e.isotopos = (composicao.get(z)?.isotopos ?? []).map((i) => ({ a: i.a, abundancia: i.abundancia }));
  fontes.isotopos = 'nist-composicao';

  e.natural = z <= 92 && !SINTETICOS_ABAIXO_DO_URANIO.has(z);
  fontes.natural = 'openem';

  // Configuração eletrônica.
  const ion = nist.get(z);
  let subniveis;
  if (ion) {
    subniveis = ion.subniveis;
    fontes.configuracao = 'nist-asd';
  } else {
    subniveis = subniveisTexto(p.ElectronConfiguration);
    fontes.configuracao = 'pubchem';
  }
  e.configuracao = ordemGeometrica(subniveis);
  if (z >= CONFIGURACAO_PREVISTA_DESDE) e.configuracaoPrevista = true;

  // Propriedades atômicas.
  e.energiaIonizacao = ion?.ev
    ? { ev: ion.ev, ...(ion.incerteza ? { incerteza: ion.incerteza } : {}), ...(ion.tipo !== 'medida' ? { estimado: ion.tipo } : {}) }
    : null;
  fontes.energiaIonizacao = 'nist-asd';

  const en = numero(p.Electronegativity);
  e.eletronegatividade = en == null ? null : { valor: en, ...(ELETRONEGATIVIDADE_ESTIMADA.has(z) ? { estimado: true } : {}) };
  fontes.eletronegatividade = 'pubchem';

  const raio = m.covalent_radius_pyykko == null ? null : Math.round(m.covalent_radius_pyykko);
  e.raio = raio == null ? null : { valor: raio, ...(z >= RAIO_CALCULADO_DESDE ? { estimado: true } : {}) };
  fontes.raio = 'pyykko-2009';

  const ea = m.electron_affinity == null ? null : Number(m.electron_affinity.toFixed(4));
  if (AFINIDADE_MEDIDA[z]) {
    e.afinidade = { ev: AFINIDADE_MEDIDA[z].ev };
    fontes.afinidade = AFINIDADE_MEDIDA[z].fonte;
  } else if (ANION_INSTAVEL.has(z)) {
    e.afinidade = { anionInstavel: true };
    fontes.afinidade = 'andersen-2004';
  } else if (ea != null && ea <= 0) {
    e.afinidade = { anionInstavel: true };
    fontes.afinidade = 'mendeleev';
  } else {
    e.afinidade = ea == null ? null : { ev: ea, ...(AFINIDADE_ESTIMADA.has(z) ? { estimado: true } : {}) };
    fontes.afinidade = 'mendeleev';
  }

  // Todos: a lista do PubChem, mais os comuns que ela não traga. Comuns: os
  // que o mendeleev classifica como principais.
  const comuns = [...(mendeleev.oxidacao.get(z)?.main ?? [])].sort((a, b) => b - a);
  // O 0 (estado do elemento livre) fica fora: o PubChem só o lista nos gases
  // nobres, como "não forma compostos".
  const todos = [...new Set([...oxidacoes(p.OxidationStates), ...comuns])].filter((o) => o !== 0).sort((a, b) => b - a);
  e.oxidacao = { todos, comuns: comuns.filter((o) => o !== 0) };
  if (z >= CATEGORIA_PREVISTA_DESDE) e.oxidacaoPrevista = true;
  fontes.oxidacao = 'pubchem';
  fontes.oxidacaoComum = 'mendeleev';

  // Propriedades físicas.
  const dens = numero(p.Density);
  e.densidade = dens == null ? null : { valor: dens, ...(DENSIDADE_ESTIMADA.has(z) ? { estimado: true } : {}) };
  fontes.densidade = 'pubchem';
  let mp = numero(p.MeltingPoint);
  const bp = numero(p.BoilingPoint);
  const estimada = FASE_ESTIMADA.has(z);
  if (mendeleev.fases.get(z)?.is_sublimation_point) {
    e.semFusao = 'sublima';
    mp = null;
  } else if (NAO_SOLIDIFICA.has(z)) {
    e.semFusao = 'nao-solidifica';
    mp = null;
  }
  e.fusao = mp == null ? null : { k: mp, ...(estimada ? { estimado: true } : {}) };
  e.ebulicao = bp == null ? null : { k: bp, ...(estimada ? { estimado: true } : {}) };
  fontes.fusao = 'pubchem';
  fontes.ebulicao = 'pubchem';

  // Estado a 25 °C: pelas temperaturas medidas; sem elas, o PubChem só prevê.
  const estado = estimada ? null : estadoA(298.15, e.fusao, e.ebulicao, e.semFusao);
  e.estado = estado;
  if (!estado) {
    const previsto = ESTADO[p.StandardState.replace(/^Expected to be an? /, '')];
    if (previsto) {
      e.estadoPrevisto = previsto;
      fontes.estadoPrevisto = 'pubchem';
    }
  }
  fontes.estado = 'openem';

  const texto = quimica.elementos[String(z)];
  if (!texto) throw new Error(`falta o texto de química do ${z} em quimica.json`);
  e.quimica = texto;
  fontes.quimica = 'openem';

  e.fontes = fontes;
  elementos.push(e);
}

// Fontes usadas, com a data em que cada uma foi baixada.
const usadas = new Set(elementos.flatMap((e) => Object.values(e.fontes)));
const todasFontes = { ...FONTES, ...FONTES_CITADAS };
const fontes = {};
for (const id of [...usadas].sort()) {
  const f = todasFontes[id];
  if (!f) throw new Error(`fonte sem cadastro: ${id}`);
  fontes[id] = { nome: f.nome, url: f.pagina ?? f.url, ...(baixadoEm[id] ? { consultadoEm: baixadoEm[id] } : {}) };
}

const datas = Object.values(baixadoEm).sort();
const catalogo = {
  conferidoEm: datas[datas.length - 1],
  revisaoCiaaw: '2024',
  familias: quimica.familias,
  fontes,
  elementos,
};

writeFileSync(SAIDA, `${JSON.stringify(catalogo, null, 1)}\n`);
console.log(`${elementos.length} elementos gravados em ${SAIDA}`);
