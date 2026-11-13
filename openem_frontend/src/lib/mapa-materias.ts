// Geometria do mapa de Matérias: as paradas em serpentina e o caminho que
// passa por elas. Puro (sem DOM) e testado em `mapa-materias.test.ts`; a tela
// (`pages/Materias.tsx`) só mede a largura e desenha.

import type { TrackSubjectSummary } from '../api';
import { areaKey, type AreaKey } from './areas';
import { ORDEM_DAS_AREAS } from './trilhas';

export interface Ponto {
  x: number;
  y: number;
}

/** Uma parada do caminho: uma matéria com trilha, ou a Redação (sem trilha). */
export type Parada =
  | { tipo: 'materia'; id: string; nome: string; area: AreaKey; materia: TrackSubjectSummary }
  | { tipo: 'redacao'; id: 'redacao'; nome: 'Redação'; area: 'red' };

/**
 * A ordem do caminho: as áreas na ordem da prova (Linguagens, Humanas,
 * Natureza, Matemática), cada uma da matéria que mais cai para a que menos
 * cai; a Redação fecha Linguagens, onde ela conta.
 */
export function paradasDoMapa(materias: readonly TrackSubjectSummary[]): Parada[] {
  const paradas: Parada[] = [];
  for (const area of ORDEM_DAS_AREAS) {
    const daArea = materias
      .filter((m) => areaKey(m.area.name) === area)
      .sort((a, b) => b.perExam - a.perExam || a.name.localeCompare(b.name, 'pt-BR'));
    for (const m of daArea) {
      paradas.push({ tipo: 'materia', id: m.id, nome: m.name, area, materia: m });
    }
    if (area === 'lin') paradas.push({ tipo: 'redacao', id: 'redacao', nome: 'Redação', area: 'red' });
  }
  return paradas;
}

/** Quantas paradas por volta do caminho cabem na largura. */
export function paradasPorVolta(largura: number): number {
  if (largura < 520) return 2;
  if (largura < 860) return 3;
  return 4;
}

export interface Medidas {
  /** Altura de cada volta do caminho. */
  volta: number;
  /** Espaço acima da primeira parada (cabe o marcador "Você está aqui"). */
  topo: number;
  /** Espaço abaixo da última parada (cabe o nome). */
  base: number;
}

export function medidasDoMapa(largura: number): Medidas {
  return largura < 520
    ? { volta: 168, topo: 64, base: 84 }
    : { volta: 184, topo: 68, base: 88 };
}

/**
 * Onde fica cada parada: voltas alternando o sentido (serpentina), com um
 * desvio pequeno e fixo em cada ponto para o caminho não sair reto como uma
 * grade. Sempre o mesmo desenho para a mesma largura.
 */
export function posicoesNoCaminho(n: number, largura: number): Ponto[] {
  const porVolta = paradasPorVolta(largura);
  const { volta, topo } = medidasDoMapa(largura);
  // Com duas por volta, as paradas ficam mais para dentro: o caminho faz
  // curvas largas em vez de encostar nas bordas.
  const margem = porVolta === 2 ? 0.24 : 0.5 / porVolta;
  const passo = porVolta === 1 ? 0 : (1 - 2 * margem) / (porVolta - 1);
  const pontos: Ponto[] = [];
  for (let i = 0; i < n; i++) {
    const linha = Math.floor(i / porVolta);
    const naLinha = i % porVolta;
    const coluna = linha % 2 === 0 ? naLinha : porVolta - 1 - naLinha;
    const desvioX = [0, 0.035, -0.03, 0.02, -0.04][i % 5];
    const desvioY = [0, 14, -10, 8, -14, 6][i % 6];
    pontos.push({
      x: Math.round(largura * (margem + coluna * passo + desvioX)),
      y: Math.round(topo + linha * volta + desvioY),
    });
  }
  return pontos;
}

/**
 * Os pontos por onde o caminho passa: as paradas e, em cada virada de volta,
 * um ponto do lado de fora, para a curva contornar a ficha e o nome em vez de
 * descer por cima deles.
 */
export function tracadoDoCaminho(paradas: readonly Ponto[], largura: number): Ponto[] {
  const porVolta = paradasPorVolta(largura);
  const pontos: Ponto[] = [];
  paradas.forEach((p, i) => {
    pontos.push(p);
    const proxima = paradas[i + 1];
    if (!proxima || (i + 1) % porVolta !== 0) return;
    // A volta termina à direita nas linhas pares e à esquerda nas ímpares.
    const paraDireita = Math.floor(i / porVolta) % 2 === 0;
    const x = paraDireita ? Math.min(largura - 14, p.x + 84) : Math.max(14, p.x - 84);
    pontos.push({ x, y: Math.round((p.y + proxima.y) / 2) });
  });
  return pontos;
}

/** Altura do mapa para n paradas. */
export function alturaDoMapa(n: number, largura: number): number {
  if (n === 0) return 0;
  const { volta, topo, base } = medidasDoMapa(largura);
  const voltas = Math.ceil(n / paradasPorVolta(largura));
  return topo + (voltas - 1) * volta + base + 24;
}

/**
 * O caminho como `d` de SVG: uma curva suave (Catmull-Rom convertida em
 * Bézier cúbica) que passa por todas as paradas, com um trecho de entrada
 * antes da primeira e de saída depois da última, como trilha que continua.
 */
export function caminhoSuave(pontos: readonly Ponto[]): string {
  if (pontos.length === 0) return '';
  if (pontos.length === 1) return `M ${pontos[0].x} ${pontos[0].y}`;
  const primeiro = pontos[0];
  const ultimo = pontos[pontos.length - 1];
  const antes = pontos[1];
  const depois = pontos[pontos.length - 2];
  const todos: Ponto[] = [
    { x: primeiro.x - (antes.x - primeiro.x) * 0.3, y: primeiro.y - 30 },
    ...pontos,
    { x: ultimo.x + (ultimo.x - depois.x) * 0.3, y: ultimo.y + 30 },
  ];
  const r = (v: number) => Math.round(v * 10) / 10;
  let d = `M ${r(todos[0].x)} ${r(todos[0].y)}`;
  for (let i = 0; i < todos.length - 1; i++) {
    const p0 = todos[Math.max(0, i - 1)];
    const p1 = todos[i];
    const p2 = todos[i + 1];
    const p3 = todos[Math.min(todos.length - 1, i + 2)];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${r(c1.x)} ${r(c1.y)} ${r(c2.x)} ${r(c2.y)} ${r(p2.x)} ${r(p2.y)}`;
  }
  return d;
}
