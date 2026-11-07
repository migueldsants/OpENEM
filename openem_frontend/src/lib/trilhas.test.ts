import { beforeEach, describe, expect, it } from 'vitest';
import {
  alternarPulada,
  decimal,
  estadoDaEtapa,
  etapaAtual,
  etapasFeitas,
  filtrosDaEtapa,
  gravarPuladas,
  lerPuladas,
  porProva,
  questoesPorProva,
  recorte,
  rotuloAnos,
} from './trilhas';

const etapa = (title: string, done = false, practicable = true) => ({
  title,
  done,
  practicable,
});

describe('etapaAtual', () => {
  it('é a primeira treinável que não foi concluída nem pulada', () => {
    const etapas = [etapa('A', true), etapa('B', false, false), etapa('C'), etapa('D')];
    expect(etapaAtual(etapas, new Set())).toBe(2);
    expect(etapaAtual(etapas, new Set(['C']))).toBe(3);
  });

  it('null quando a trilha acabou', () => {
    expect(etapaAtual([etapa('A', true)], new Set())).toBeNull();
    expect(etapaAtual([etapa('A')], new Set(['A']))).toBeNull();
  });
});

describe('estadoDaEtapa', () => {
  it('concluída vence a marca de pulada; sem questão nunca é a atual', () => {
    const puladas = new Set(['A', 'B']);
    expect(estadoDaEtapa(etapa('A', true), 0, 2, puladas)).toBe('concluida');
    expect(estadoDaEtapa(etapa('B'), 1, 2, puladas)).toBe('pulada');
    expect(estadoDaEtapa(etapa('C'), 2, 2, puladas)).toBe('atual');
    expect(estadoDaEtapa(etapa('D'), 3, 2, puladas)).toBe('futura');
    expect(estadoDaEtapa(etapa('E', false, false), 4, 2, puladas)).toBe(
      'sem-questoes',
    );
  });

  it('conta concluídas e puladas como feitas', () => {
    expect(
      etapasFeitas([etapa('A', true), etapa('B'), etapa('C')], new Set(['B'])),
    ).toBe(2);
  });
});

describe('"já sei isso"', () => {
  beforeEach(() => localStorage.clear());

  it('liga e desliga por matéria, e some quando esvazia', () => {
    let p = alternarPulada({}, 'mat', 'Base');
    expect(p).toEqual({ mat: ['Base'] });
    p = alternarPulada(p, 'mat', 'Base');
    expect(p).toEqual({});
  });

  it('grava por aluno: outro aluno no mesmo aparelho não herda', () => {
    gravarPuladas('u1', { mat: ['Base'] });
    expect(lerPuladas('u1')).toEqual({ mat: ['Base'] });
    expect(lerPuladas('u2')).toEqual({});
    expect(lerPuladas(undefined)).toEqual({});
  });

  it('dado corrompido vira vazio', () => {
    localStorage.setItem('openem.trilhas.puladas:u1', '{"mat": [1, "Base"], "x": 3');
    expect(lerPuladas('u1')).toEqual({});
    localStorage.setItem('openem.trilhas.puladas:u1', '{"mat": [1, "Base"], "x": 3}');
    expect(lerPuladas('u1')).toEqual({ mat: ['Base'] });
  });
});

describe('números', () => {
  it('formata em português com uma casa', () => {
    expect(decimal(4.8)).toBe('4,8');
    expect(decimal(1)).toBe('1');
    expect(decimal(44.8)).toBe('44,8');
    expect(decimal(0.02)).toBe('0');
  });

  it('rótulos de incidência', () => {
    expect(porProva(1.7)).toBe('1,7 por prova');
    expect(porProva(0)).toBe('não caiu');
    expect(questoesPorProva(1)).toBe('1 questão por prova');
    expect(questoesPorProva(16.4)).toBe('16,4 questões por prova');
    expect(rotuloAnos(10, 10)).toBe('10 de 10 provas');
    expect(rotuloAnos(1, 1)).toBe('1 de 1 prova');
  });

  it('descreve o recorte', () => {
    expect(recorte({ fromYear: 2016, toYear: 2025, exams: 10, years: [] })).toBe(
      'nas provas regulares de 2016 a 2025',
    );
    expect(recorte({ fromYear: 2023, toYear: 2023, exams: 1, years: [] })).toBe(
      'na prova regular de 2023',
    );
    expect(recorte(null)).toBe('nas provas regulares do banco');
  });

  it('o simulado da etapa leva os assuntos e 10 questões', () => {
    expect(filtrosDaEtapa(['a', 'b'])).toEqual({
      topicIds: ['a', 'b'],
      questionCount: 10,
    });
  });
});
