/**
 * Gera openem_frontend/src/data/nuclideos.json: todos os nuclídeos já
 * observados de cada elemento (estado fundamental), da IAEA LiveChart, a
 * mesma fonte que o montar.mjs usa para "radioativo" e "isótopo mais
 * estável". É o que o simulador de átomo usa para deixar montar só isótopos
 * que existem. Fica separado do elementos.json para a tabela periódica não
 * baixar 3 mil linhas que ela não mostra.
 *
 *   node tools/tabela-periodica/baixar.mjs     (se ainda não baixou)
 *   node tools/tabela-periodica/nuclideos.mjs
 *
 * Nunca edite o JSON à mão.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { lerCsv, lerFonte, PASTA_FONTES, SAIDA } from './comum.mjs';

const DESTINO = join(SAIDA, '..', 'nuclideos.json');

/** Modo de decaimento principal, no rótulo da escola. */
const MODOS = {
  'B-': 'β⁻',
  'EC+B+': 'β⁺ / captura eletrônica',
  EC: 'captura eletrônica',
  A: 'α',
  P: 'emissão de próton',
  '2P': 'emissão de dois prótons',
  N: 'emissão de nêutron',
  '2N': 'emissão de dois nêutrons',
  SF: 'fissão espontânea',
  '2B-': 'duplo β⁻',
  'B-N': 'β⁻ com nêutron',
  'B-2N': 'β⁻ com dois nêutrons',
  IT: 'transição isomérica',
};

const datas = JSON.parse(readFileSync(join(PASTA_FONTES, 'baixado-em.json'), 'utf8'));
const porZ = {};
let total = 0;
for (const r of lerCsv(lerFonte('iaea-livechart'))) {
  const z = Number(r.z);
  if (!z) continue; // o nêutron livre não é elemento
  const a = z + Number(r.n);
  const estavel = r.half_life === 'STABLE';
  const seg = r.half_life_sec ? Number(r.half_life_sec) : null;
  // [A, meia-vida em s (null = estável ou desconhecida), meia-vida como a IAEA escreve, unidade, modo, abundância natural %]
  const linha = [
    a,
    estavel ? null : seg,
    estavel ? 'estável' : r.half_life || '?',
    estavel ? '' : r.unit_hl,
    estavel ? '' : (MODOS[r.decay_1] ?? r.decay_1 ?? ''),
    r.abundance ? Number(r.abundance) : null,
  ];
  (porZ[z] ??= []).push(linha);
  total++;
}
for (const z of Object.keys(porZ)) porZ[z].sort((x, y) => x[0] - y[0]);

const saida = {
  fonte: 'iaea-livechart',
  conferidoEm: datas['iaea-livechart'],
  colunas: ['a', 'meiaVidaSeg', 'meiaVida', 'unidade', 'decaimento', 'abundancia'],
  nuclideos: porZ,
};
writeFileSync(DESTINO, `${JSON.stringify(saida)}\n`);
console.log(`nuclideos.json: ${total} nuclídeos de ${Object.keys(porZ).length} elementos`);
