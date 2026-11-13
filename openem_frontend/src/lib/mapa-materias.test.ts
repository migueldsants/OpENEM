import { describe, expect, it } from 'vitest';
import type { TrackSubjectSummary } from '../api';
import {
  alturaDoMapa,
  caminhoSuave,
  paradasDoMapa,
  paradasPorVolta,
  posicoesNoCaminho,
  tracadoDoCaminho,
} from './mapa-materias';

const m = (name: string, area: string, perExam: number): TrackSubjectSummary => ({
  id: name,
  name,
  area: { id: area, name: area },
  perExam,
  mastery: 0,
  answered: 0,
  currentStage: 0,
  stages: [],
});

const LIN = 'Linguagens, Códigos e suas Tecnologias';
const HUM = 'Ciências Humanas e suas Tecnologias';
const NAT = 'Ciências da Natureza e suas Tecnologias';
const MAT = 'Matemática e suas Tecnologias';

describe('paradasDoMapa', () => {
  it('segue a ordem da prova, do que mais cai ao que menos cai, com a Redação fechando Linguagens', () => {
    const paradas = paradasDoMapa([
      m('Matemática', MAT, 45),
      m('Física', NAT, 14),
      m('Biologia', NAT, 15),
      m('Artes', LIN, 5),
      m('Língua Portuguesa', LIN, 25.8),
      m('História', HUM, 14),
    ]);
    expect(paradas.map((p) => p.nome)).toEqual([
      'Língua Portuguesa',
      'Artes',
      'Redação',
      'História',
      'Biologia',
      'Física',
      'Matemática',
    ]);
    expect(paradas[2]).toMatchObject({ tipo: 'redacao', area: 'red' });
  });
});

describe('posicoesNoCaminho', () => {
  it('cabem mais paradas por volta em tela larga', () => {
    expect(paradasPorVolta(360)).toBe(2);
    expect(paradasPorVolta(700)).toBe(3);
    expect(paradasPorVolta(1100)).toBe(4);
  });

  it('as voltas alternam o sentido (serpentina) e ficam dentro da largura', () => {
    const largura = 700;
    const p = posicoesNoCaminho(9, largura);
    // Primeira volta da esquerda para a direita, segunda da direita para a esquerda.
    expect(p[0].x).toBeLessThan(p[2].x);
    expect(p[3].x).toBeGreaterThan(p[5].x);
    // A última da primeira volta e a primeira da segunda ficam do mesmo lado.
    expect(Math.abs(p[2].x - p[3].x)).toBeLessThan(largura * 0.1);
    for (const q of p) {
      expect(q.x).toBeGreaterThan(0);
      expect(q.x).toBeLessThan(largura);
    }
  });

  it('cada volta fica abaixo da anterior e o mapa tem altura para todas', () => {
    const p = posicoesNoCaminho(14, 360);
    for (let i = 2; i < p.length; i += 2) expect(p[i].y).toBeGreaterThan(p[i - 2].y);
    const ultima = Math.max(...p.map((q) => q.y));
    expect(alturaDoMapa(14, 360)).toBeGreaterThan(ultima + 60);
  });

  it('é sempre o mesmo desenho para a mesma largura', () => {
    expect(posicoesNoCaminho(14, 800)).toEqual(posicoesNoCaminho(14, 800));
  });
});

describe('caminhoSuave', () => {
  it('é uma curva que passa por todas as paradas', () => {
    const pontos = posicoesNoCaminho(5, 700);
    const d = caminhoSuave(pontos);
    expect(d.startsWith('M ')).toBe(true);
    // Uma Bézier para cada trecho: entrada, entre as paradas e saída.
    expect(d.match(/ C /g)).toHaveLength(pontos.length + 1);
    for (const q of pontos) expect(d).toContain(`${q.x} ${q.y}`);
  });

  it('na virada de volta o caminho sai por fora das fichas', () => {
    const largura = 700;
    const paradas = posicoesNoCaminho(6, largura);
    const tracado = tracadoDoCaminho(paradas, largura);
    expect(tracado).toHaveLength(7);
    // Entre a 3ª e a 4ª parada (mesmo lado, à direita) entra um ponto mais à direita.
    expect(tracado[3].x).toBeGreaterThan(Math.max(paradas[2].x, paradas[3].x));
    expect(tracado[3].x).toBeLessThanOrEqual(largura - 14);
    expect(tracado[3].y).toBeGreaterThan(paradas[2].y);
    expect(tracado[3].y).toBeLessThan(paradas[3].y);
  });

  it('sem paradas não desenha nada', () => {
    expect(caminhoSuave([])).toBe('');
  });
});
