import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { temMiniatura } from '../../components/simulacoes/miniaturas';
import { REGISTRO } from '../../components/simulacoes/registro';
import {
  filtrarSimulacoes,
  MATERIAS_SIM,
  materiaPorSlug,
  SIMULACOES,
  simulacaoPorSlug,
  simulacoesDaMateria,
  SLUG_DA_MATERIA,
} from './catalogo';

describe('catálogo de simulações', () => {
  it('slugs únicos, em kebab-case, e cada um com o seu componente no registro', () => {
    const slugs = SIMULACOES.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(Object.keys(REGISTRO).sort()).toEqual([...slugs].sort());
    // Toda simulação tem a sua miniatura viva na lista.
    for (const s of slugs) expect(temMiniatura(s), s).toBe(true);
  });

  it('cobre as quatro matérias e tem simulações 2D e 3D', () => {
    for (const m of MATERIAS_SIM) expect(SIMULACOES.some((s) => s.materia === m), m).toBe(true);
    expect(SIMULACOES.some((s) => s.dimensao === '3D')).toBe(true);
    expect(SIMULACOES.some((s) => s.dimensao === '2D')).toBe(true);
  });

  it('todo item tem resumo e conceitos, sem travessão no texto do aluno', () => {
    for (const s of SIMULACOES) {
      expect(s.resumo.length, s.slug).toBeGreaterThan(40);
      expect(s.conceitos.length, s.slug).toBeGreaterThan(1);
      expect(`${s.titulo} ${s.resumo}`, s.slug).not.toMatch(/—/);
    }
  });

  it('busca sem acento e por conceito', () => {
    expect(filtrarSimulacoes(SIMULACOES, 'refracao', null, null).map((s) => s.slug)).toContain('refracao');
    expect(filtrarSimulacoes(SIMULACOES, 'kepler', null, null).map((s) => s.slug)).toEqual(['orbitas']);
    expect(filtrarSimulacoes(SIMULACOES, 'LE CHATELIER', null, null).map((s) => s.slug)).toEqual(['equilibrio-quimico']);
  });

  it('filtra por matéria e por dimensão', () => {
    const quimica3d = filtrarSimulacoes(SIMULACOES, '', 'Química', '3D');
    expect(quimica3d.map((s) => s.slug)).toEqual(['geometria-molecular', 'cristais', 'isomeria', 'atomo']);
    expect(filtrarSimulacoes(SIMULACOES, '', 'Geografia', null).every((s) => s.materia === 'Geografia')).toBe(true);
    expect(filtrarSimulacoes(SIMULACOES, 'nada que exista aqui', null, null)).toEqual([]);
  });

  it('cada matéria tem endereço próprio, sem colidir com uma simulação, e rota no App', () => {
    const app = readFileSync(resolve(__dirname, '../../App.tsx'), 'utf8');
    const slugsSim = new Set(SIMULACOES.map((s) => s.slug));
    for (const m of MATERIAS_SIM) {
      const slug = SLUG_DA_MATERIA[m];
      expect(slug).toMatch(/^[a-z]+$/);
      expect(slugsSim.has(slug), slug).toBe(false);
      expect(materiaPorSlug(slug)).toBe(m);
      expect(app, slug).toContain(`path="/simulacoes/${slug}" element={<SimulacoesMateria materia="${m}" />}`);
    }
    expect(materiaPorSlug('pendulo')).toBeUndefined();
  });

  it('a matéria lista as cenas 3D primeiro', () => {
    const fisica = simulacoesDaMateria('Física');
    expect(fisica.every((s) => s.materia === 'Física')).toBe(true);
    expect(fisica.length).toBe(SIMULACOES.filter((s) => s.materia === 'Física').length);
    const primeira2d = fisica.findIndex((s) => s.dimensao === '2D');
    expect(fisica.slice(primeira2d).every((s) => s.dimensao === '2D')).toBe(true);
  });

  it('acha pelo slug', () => {
    expect(simulacaoPorSlug('pendulo')?.titulo).toBe('Pêndulo simples');
    expect(simulacaoPorSlug('nao-existe')).toBeUndefined();
    expect(simulacaoPorSlug(undefined)).toBeUndefined();
  });
});
