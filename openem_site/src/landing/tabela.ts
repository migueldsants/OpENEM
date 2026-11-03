// Lógica pura da prévia da tabela periódica na landing (testada em
// logica.test.ts). Os dados vêm de `virtual:tabela-periodica`, extraídos no
// build por tabela-dados.ts.

import type { CasaDaPrevia, ModoDaPrevia } from './tabela-dados';

/** Duração total da onda de cor ao trocar de modo, em ms. */
export const ONDA_MS = 520;

const ULTIMA_COLUNA = 18;
const ULTIMA_LINHA = 10;

/**
 * Atraso da troca de cor de uma casa, em ms. Nas tendências a cor corre no
 * sentido em que a propriedade cresce (a eletronegatividade sobe da esquerda
 * de baixo para a direita de cima), então a própria animação mostra a
 * tendência. Voltando às categorias, a cor corre pelo número atômico.
 */
export function atrasoDaOnda(casa: Pick<CasaDaPrevia, 'z' | 'linha' | 'coluna'>, modo: ModoDaPrevia): number {
  if (!modo.periodo || !modo.grupo) return Math.round(((casa.z - 1) / 117) * ONDA_MS);
  const x = (casa.coluna - 1) / (ULTIMA_COLUNA - 1);
  const y = (casa.linha - 1) / (ULTIMA_LINHA - 1);
  const ao = modo.periodo === 'direita' ? x : 1 - x;
  const ag = modo.grupo === 'cima' ? 1 - y : y;
  return Math.round(((ao + ag) / 2) * ONDA_MS);
}

export type Direcao = 'esquerda' | 'direita' | 'cima' | 'baixo';

/**
 * Elemento vizinho na grade, para as setas do teclado: na mesma linha, a
 * casa seguinte que existe; na mesma coluna, a linha seguinte que tem casa
 * (pula o vão do corpo e a faixa entre o corpo e as séries f). Sem vizinho,
 * fica onde está.
 */
export function vizinho(
  casas: Pick<CasaDaPrevia, 'z' | 'linha' | 'coluna'>[],
  z: number,
  direcao: Direcao,
): number {
  const atual = casas.find((c) => c.z === z);
  if (!atual) return z;
  const horizontal = direcao === 'esquerda' || direcao === 'direita';
  const sinal = direcao === 'direita' || direcao === 'baixo' ? 1 : -1;
  const candidatas = casas.filter((c) =>
    horizontal
      ? c.linha === atual.linha && Math.sign(c.coluna - atual.coluna) === sinal
      : c.coluna === atual.coluna && Math.sign(c.linha - atual.linha) === sinal,
  );
  const distancia = (c: Pick<CasaDaPrevia, 'linha' | 'coluna'>) =>
    horizontal ? Math.abs(c.coluna - atual.coluna) : Math.abs(c.linha - atual.linha);
  candidatas.sort((a, b) => distancia(a) - distancia(b));
  return candidatas[0]?.z ?? z;
}

const SETA = { esquerda: 'para a esquerda', direita: 'para a direita', cima: 'para cima', baixo: 'para baixo' };

/** "Cresce para a direita e para cima." */
export function sentidoDaTendencia(modo: ModoDaPrevia): string | null {
  if (!modo.periodo || !modo.grupo) return null;
  return `Cresce ${SETA[modo.periodo]} e ${SETA[modo.grupo]}.`;
}
