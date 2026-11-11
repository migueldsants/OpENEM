/**
 * Contextos da tela de uma simulação (fora dos componentes, para o Fast
 * Refresh): o palco que preenche a altura da tela e o lugar do botão
 * "Entenda", que abre a explicação num modal.
 */
import { createContext } from 'react';
import type { SimulacaoInfo } from '../../lib/simulacoes/catalogo';

/**
 * Dentro do `LayoutSim`, no desktop, o palco ocupa a altura que sobra na tela
 * em vez de seguir a proporção: a simulação cabe sem rolar a página.
 */
export const PalcoCheioCtx = createContext(false);

export interface LugarExplicacao {
  /** Elemento do cabeçalho da página onde o botão "Entenda" é desenhado. */
  slot: HTMLElement | null;
  info: SimulacaoInfo;
}

/** Fornecido pela página da simulação; sem ele, a explicação aparece no fluxo. */
export const ExplicacaoCtx = createContext<LugarExplicacao | null>(null);
