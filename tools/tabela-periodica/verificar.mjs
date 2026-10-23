// Confere o catálogo gerado por `montar.mjs` contra uma SEGUNDA fonte, campo a
// campo. Uma divergência só passa se estiver em `divergencias.json`, com o
// motivo; uma explicação que não corresponde mais a nenhuma divergência
// também derruba a verificação (a lista não pode envelhecer em silêncio).
// Precisa fechar com 0 divergências não explicadas.
//
//   node tools/tabela-periodica/verificar.mjs [--todas]
//
// Com --todas, lista também as divergências explicadas.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AQUI,
  SAIDA,
  abrirMendeleev,
  lerIaea,
  lerNistComposicao,
  lerNomesTabelaPeriodicaOrg,
  lerPubchem,
  mesmaConfiguracao,
  semAcento,
  subniveisTexto,
  valorComIncerteza,
} from './comum.mjs';

const catalogo = JSON.parse(readFileSync(SAIDA, 'utf8'));
const explicadas = JSON.parse(readFileSync(join(AQUI, 'divergencias.json'), 'utf8'));
const mostrarTodas = process.argv.includes('--todas');

const pubchem = lerPubchem();
const composicao = lerNistComposicao();
const iaea = lerIaea();
const nomesOrg = lerNomesTabelaPeriodicaOrg();
const mendeleev = await abrirMendeleev();

const achadas = []; // { campo, z, detalhe }
const usadas = new Set();

/**
 * A chave de uma explicação é um número atômico ("26"), uma faixa ("58-71")
 * ou uma lista ("57,89"): vale para todos eles.
 */
function cobre(chave, z) {
  return chave.split(',').some((parte) => {
    const [a, b = a] = parte.split('-').map(Number);
    return z >= a && z <= b;
  });
}

function divergencia(campo, z, detalhe) {
  const chave = Object.keys(explicadas[campo] ?? {}).find((k) => cobre(k, z));
  const motivo = chave ? explicadas[campo][chave] : undefined;
  if (chave) usadas.add(`${campo}:${chave}`);
  achadas.push({ campo, z, detalhe, motivo });
}

const perto = (a, b, abs, rel = 0) => Math.abs(a - b) <= Math.max(abs, rel * Math.abs(b));

const SEGUNDOS = { ms: 1e-3, s: 1, min: 60, m: 60, h: 3600, d: 86400, a: 31556926, Y: 31556926, ka: 31556926e3, Ma: 31556926e6 };

const SERIE = {
  Nonmetals: 'nao-metal',
  'Noble gases': 'gas-nobre',
  'Alkali metals': 'alcalino',
  'Alkaline earth metals': 'alcalino-terroso',
  Metalloids: 'semimetal',
  Halogens: 'halogenio',
  'Poor metals': 'pos-transicao',
  'Transition metals': 'transicao',
  Lanthanides: 'lantanideo',
  Actinides: 'actinideo',
};

// Estrutura geral.
const zs = catalogo.elementos.map((e) => e.z);
if (zs.length !== 118 || zs.some((z, i) => z !== i + 1)) divergencia('estrutura', 0, 'Z não vai de 1 a 118 sem buraco');
for (const e of catalogo.elementos) {
  for (const [campo, id] of Object.entries(e.fontes)) {
    if (!catalogo.fontes[id]) divergencia('fontes', e.z, `${campo} cita a fonte ${id}, que não está no catálogo`);
  }
}

for (const e of catalogo.elementos) {
  const { z } = e;
  const p = pubchem.get(z);
  const m = mendeleev.elementos.get(z);

  // Símbolo e nome em inglês (CIAAW × PubChem).
  if (e.simbolo !== p.Symbol) divergencia('simbolo', z, `${e.simbolo} × PubChem ${p.Symbol}`);
  if (semAcento(e.nomeEn) !== semAcento(p.Name)) divergencia('nomeEn', z, `${e.nomeEn} × PubChem ${p.Name}`);

  // Nome em português (nomes.json × tabelaperiodica.org).
  const org = nomesOrg.get(z);
  if (!org) divergencia('nome', z, 'ausente na tabelaperiodica.org');
  else {
    const aceitos = [e.nome, ...(e.variantes ?? [])].map(semAcento);
    if (!aceitos.includes(semAcento(org.nome))) divergencia('nome', z, `${e.nome} × tabelaperiodica.org ${org.nome}`);
    if (org.simbolo !== e.simbolo) divergencia('simbolo', z, `${e.simbolo} × tabelaperiodica.org ${org.simbolo}`);
  }

  // Massa atômica padrão (CIAAW 2024 × NIST).
  const nist = composicao.get(z)?.padrao ?? '';
  if (e.massa.padrao?.intervalo) {
    const [a, b] = e.massa.padrao.intervalo;
    if (nist !== `[${a},${b}]`) divergencia('massa', z, `[${a}, ${b}] × NIST ${nist}`);
  } else if (e.massa.padrao) {
    const n = valorComIncerteza(nist);
    if (!n || n.valor !== e.massa.padrao.valor || n.incerteza !== e.massa.padrao.incerteza) {
      divergencia('massa', z, `${e.massa.padrao.valor}(±${e.massa.padrao.incerteza}) × NIST ${nist}`);
    }
  } else if (nist !== `[${e.massa.numeroMassa}]`) {
    divergencia('massa', z, `[${e.massa.numeroMassa}] × NIST ${nist}`);
  }

  // Massa abreviada (CIAAW × PubChem, dentro da incerteza da abreviada).
  const pm = Number(p.AtomicMass);
  if (e.massa.abreviado) {
    // O PubChem arredonda (55.84 para 55.845): a tolerância soma meia casa dele.
    const { valor, incerteza } = e.massa.abreviado;
    const casas = (p.AtomicMass.split('.')[1] ?? '').length;
    if (!perto(pm, Number(valor), Number(incerteza) + 0.5 * 10 ** -casas + 1e-9)) divergencia('abreviado', z, `${valor} ± ${incerteza} × PubChem ${p.AtomicMass}`);
  } else if (Math.round(pm) !== e.massa.numeroMassa) {
    divergencia('abreviado', z, `[${e.massa.numeroMassa}] × PubChem ${p.AtomicMass}`);
  }

  // Radioatividade e isótopo de vida mais longa (CIAAW × IAEA).
  const nuc = iaea.get(z);
  if (e.radioativo !== Boolean(m.is_radioactive)) divergencia('radioativo', z, `${e.radioativo} × mendeleev ${m.is_radioactive}`);
  if (e.isotopoMaisEstavel) {
    const maior = nuc.isotopos
      .filter((i) => i.meiaVidaSeg != null && i.operador == null)
      .sort((a, b) => b.meiaVidaSeg - a.meiaVidaSeg)[0];
    const { a, meiaVida } = e.isotopoMaisEstavel;
    if (maior.a !== a) divergencia('isotopoMaisEstavel', z, `${a} × IAEA ${maior.a}`);
    const mesmo = nuc.isotopos.find((i) => i.a === a);
    const seg = Number(meiaVida.valor) * SEGUNDOS[meiaVida.unidade];
    if (!mesmo?.meiaVidaSeg || !perto(seg, mesmo.meiaVidaSeg, 0, 0.15)) {
      divergencia('meiaVida', z, `${a}: ${meiaVida.valor} ${meiaVida.unidade} × IAEA ${mesmo?.meiaVida?.valor} ${mesmo?.meiaVida?.unidade}`);
    }
  }

  // Isótopos naturais (NIST × IAEA, abundância em %).
  const naturaisIaea = nuc.isotopos.filter((i) => i.abundancia != null);
  const as = e.isotopos.map((i) => i.a).join(',');
  const asIaea = naturaisIaea.map((i) => i.a).join(',');
  if (as !== asIaea) divergencia('isotopos', z, `${as || '—'} × IAEA ${asIaea || '—'}`);
  else {
    for (const i of e.isotopos) {
      const nosso = Number(i.abundancia.replace(/\(.*\)/, '')) * 100;
      const deles = naturaisIaea.find((x) => x.a === i.a).abundancia;
      if (!perto(nosso, deles, 0.05, 0.02)) divergencia('isotopos', z, `${i.a}: ${nosso.toFixed(4)}% × IAEA ${deles}%`);
    }
  }

  // Configuração eletrônica (NIST/PubChem × PubChem/mendeleev).
  const pc = subniveisTexto(p.ElectronConfiguration);
  const me = subniveisTexto(m.electronic_configuration);
  if (!mesmaConfiguracao(e.configuracao, pc)) divergencia('configuracao', z, `${e.configuracao.join(' ')} × PubChem ${p.ElectronConfiguration}`);
  if (!mesmaConfiguracao(e.configuracao, me)) divergencia('configuracao-mendeleev', z, `${e.configuracao.join(' ')} × mendeleev ${m.electronic_configuration}`);
  const eletrons = e.configuracao.reduce((n, s) => n + Number(s.slice(2)), 0);
  if (eletrons !== z) divergencia('estrutura', z, `a configuração soma ${eletrons} elétrons`);

  // Posição (montar.mjs × mendeleev).
  if (e.periodo !== m.period) divergencia('periodo', z, `${e.periodo} × mendeleev ${m.period}`);
  if (e.bloco !== m.block) divergencia('bloco', z, `${e.bloco} × mendeleev ${m.block}`);
  if (e.grupo !== m.group_id) divergencia('grupo', z, `${e.grupo} × mendeleev ${m.group_id}`);

  // Categoria (PubChem × mendeleev).
  const serie = SERIE[mendeleev.series.get(m.series_id)];
  if (e.categoria !== serie) divergencia('categoria', z, `${e.categoria} × mendeleev ${mendeleev.series.get(m.series_id)}`);

  // Energia de ionização (NIST × PubChem).
  const iePc = p.IonizationEnergy === '' ? null : Number(p.IonizationEnergy);
  if ((e.energiaIonizacao == null) !== (iePc == null)) divergencia('energiaIonizacao', z, `${e.energiaIonizacao?.ev ?? '—'} × PubChem ${iePc ?? '—'}`);
  else if (iePc != null && !perto(Number(e.energiaIonizacao.ev), iePc, 0.01, 0.005)) {
    divergencia('energiaIonizacao', z, `${e.energiaIonizacao.ev} × PubChem ${iePc}`);
  }

  // Eletronegatividade (PubChem × mendeleev).
  const en = e.eletronegatividade?.valor ?? null;
  if ((en == null) !== (m.en_pauling == null)) divergencia('eletronegatividade', z, `${en ?? '—'} × mendeleev ${m.en_pauling ?? '—'}`);
  else if (en != null && !perto(en, m.en_pauling, 0.02)) divergencia('eletronegatividade', z, `${en} × mendeleev ${m.en_pauling}`);

  // Raio covalente (Pyykkö × Cordero): os dois são raios covalentes de
  // ligação simples, de trabalhos independentes; a conferência é de ordem de
  // grandeza (até 15% de diferença), não de igualdade.
  if (e.raio && m.covalent_radius_cordero != null && !perto(e.raio.valor, m.covalent_radius_cordero, 0, 0.15)) {
    divergencia('raio', z, `${e.raio.valor} pm × Cordero ${Math.round(m.covalent_radius_cordero)} pm`);
  }
  if (!e.raio) divergencia('raio', z, 'sem raio');

  // Afinidade eletrônica (mendeleev/CRC × PubChem).
  const af = e.afinidade;
  const afP = p.ElectronAffinity === '' ? null : Number(p.ElectronAffinity);
  if (af?.anionInstavel) {
    if (afP != null && afP > 0) divergencia('afinidade', z, `ânion instável × PubChem ${afP} eV`);
  } else if ((af == null) !== (afP == null)) divergencia('afinidade', z, `${af?.ev ?? '—'} × PubChem ${afP ?? '—'}`);
  else if (af && !perto(af.ev, afP, 0.05)) divergencia('afinidade', z, `${af.ev} × PubChem ${afP}`);

  // Estados de oxidação (PubChem × mendeleev).
  const oxM = mendeleev.oxidacao.get(z) ?? { main: [], extended: [] };
  const todosM = new Set([...oxM.main, ...oxM.extended]);
  const fora = e.oxidacao.todos.filter((o) => !todosM.has(o));
  if (fora.length) divergencia('oxidacao', z, `${fora.join(', ')} não está no mendeleev`);
  if (e.oxidacao.comuns.some((o) => !e.oxidacao.todos.includes(o))) divergencia('estrutura', z, 'estado comum fora da lista');

  // Densidade (PubChem × mendeleev): gases a 0 °C × 25 °C, daí os 10%.
  const d = e.densidade?.valor ?? null;
  if (d != null && m.density != null) {
    const tol = e.estado === 'gasoso' ? 0.12 : 0.05;
    if (!perto(d, m.density, 0, tol)) divergencia('densidade', z, `${d} × mendeleev ${m.density}`);
  } else if (d != null || (m.density != null && !e.densidade?.estimado && z < 99)) {
    divergencia('densidade', z, `${d ?? '—'} × mendeleev ${m.density ?? '—'}`);
  }

  // Fusão e ebulição (PubChem × mendeleev, CRC).
  const f = mendeleev.fases.get(z);
  for (const [campo, nosso, deles] of [
    ['fusao', e.fusao?.k, f?.is_sublimation_point ? null : f?.melting_point],
    ['ebulicao', e.ebulicao?.k, f?.boiling_point],
  ]) {
    if (nosso == null && deles == null) continue;
    if (nosso == null || deles == null || !perto(nosso, deles, 5, 0.01)) {
      divergencia(campo, z, `${nosso ?? '—'} K × mendeleev ${deles != null ? deles.toFixed(2) : '—'} K`);
    }
  }

  // Estado a 25 °C (calculado × PubChem).
  const ESTADO = { Solid: 'solido', Liquid: 'liquido', Gas: 'gasoso' };
  const est = ESTADO[p.StandardState] ?? null;
  if ((e.estado ?? null) !== est) divergencia('estado', z, `${e.estado ?? '—'} × PubChem ${p.StandardState}`);
}

for (const [campo, mapa] of Object.entries(explicadas)) {
  if (campo.startsWith('_')) continue;
  for (const z of Object.keys(mapa)) {
    if (!usadas.has(`${campo}:${z}`)) achadas.push({ campo, z: Number(z), detalhe: 'explicação sem divergência (apague de divergencias.json)' });
  }
}

const abertas = achadas.filter((a) => !a.motivo);
for (const a of mostrarTodas ? achadas : abertas) {
  console.log(`${a.motivo ? 'ok  ' : 'ERRO'} ${a.campo.padEnd(22)} ${String(a.z).padStart(3)}  ${a.detalhe}${a.motivo ? `  — ${a.motivo}` : ''}`);
}
console.log(`\n${achadas.length - abertas.length} divergências explicadas, ${abertas.length} não explicadas.`);
process.exit(abertas.length ? 1 : 0);
