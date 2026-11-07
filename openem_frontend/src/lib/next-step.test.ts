import { describe, expect, it } from 'vitest';
import type { Recommendation, StudySession } from '../api';
import { proximoPasso } from './next-step';
import { sessoesDeHoje } from './plan';

const sessao = (over: Partial<StudySession> = {}): StudySession => ({
  id: 's1',
  label: 'Matemática',
  dayIndex: 0,
  minutes: 30,
  done: false,
  position: 0,
  subject: null,
  ...over,
});

const rec = {
  question: {
    topic: {
      id: 't 1',
      name: 'Funções',
      subject: { id: 'm', name: 'Matemática' },
    },
  },
  reason: 'Você errou 3 de 4 em Funções.',
} as unknown as Recommendation;

describe('proximoPasso', () => {
  it('revisão vencida vem antes de tudo', () => {
    const p = proximoPasso({
      vencidas: 2,
      hoje: [sessao()],
      recomendacao: rec,
    });
    expect(p.tipo).toBe('revisao');
    expect(p.titulo).toBe('2 assuntos para revisar');
    expect(p.to).toBe('/revisao');
  });

  it('singular quando é um assunto só', () => {
    expect(
      proximoPasso({ vencidas: 1, hoje: [], recomendacao: null }).titulo,
    ).toBe('1 assunto para revisar');
  });

  it('sem revisão, o primeiro bloco pendente de hoje', () => {
    const p = proximoPasso({
      vencidas: 0,
      hoje: [
        sessao({ done: true, label: 'Física' }),
        sessao({ id: 's2', label: 'Química', minutes: 45 }),
      ],
      recomendacao: rec,
    });
    expect(p.tipo).toBe('cronograma');
    expect(p.titulo).toBe('Hoje no cronograma: Química');
    expect(p.descricao).toContain('1 de 2');
    expect(p.to).toBe('/cronograma');
  });

  it('nenhum bloco feito ainda: fala do primeiro, sem "você já fez"', () => {
    const p = proximoPasso({
      vencidas: 0,
      hoje: [sessao({ minutes: 30 }), sessao({ id: 's2' })],
      recomendacao: null,
    });
    expect(p.descricao).toBe('30 min, o primeiro de 2 blocos de hoje.');
    expect(
      proximoPasso({ vencidas: 0, hoje: [sessao()], recomendacao: null }).descricao,
    ).toBe('30 min, o primeiro de 1 bloco de hoje.');
  });

  it('dia concluído passa para a recomendação, com o assunto na URL', () => {
    const p = proximoPasso({
      vencidas: 0,
      hoje: [sessao({ done: true })],
      recomendacao: rec,
    });
    expect(p.tipo).toBe('recomendacao');
    expect(p.to).toBe('/questoes?topicId=t%201');
    expect(p.descricao).toBe(rec.reason);
  });

  it('recomendação sem assunto (questão oficial sem classificação) não serve', () => {
    const semAssunto = {
      ...rec,
      question: { topic: null },
    } as unknown as Recommendation;
    expect(
      proximoPasso({ vencidas: 0, hoje: [], recomendacao: semAssunto }).tipo,
    ).toBe('comecar');
  });
});

describe('sessoesDeHoje', () => {
  it('pega só os blocos do dia de hoje, na ordem', () => {
    const plan = {
      id: 'p',
      minutesPerDay: 60,
      createdAt: new Date(2026, 8, 20, 15).toISOString(),
      sessions: [
        sessao({ id: 'a', dayIndex: 4, position: 1 }),
        sessao({ id: 'b', dayIndex: 3 }),
        sessao({ id: 'c', dayIndex: 4, position: 0 }),
      ],
    };
    const hoje = sessoesDeHoje(plan, new Date(2026, 8, 24, 9));
    expect(hoje.map((s) => s.id)).toEqual(['c', 'a']);
  });
});

describe('proximoPasso — trilha', () => {
  const daTrilha = {
    ...rec,
    reason: 'Trilha de Matemática: Base numérica',
    track: {
      subjectId: 's mat',
      subjectName: 'Matemática',
      stage: 1,
      title: 'Base numérica',
    },
  } as Recommendation;

  it('aluno sem erro recente vai para a etapa da trilha', () => {
    const p = proximoPasso({ vencidas: 0, hoje: [], recomendacao: daTrilha });
    expect(p.tipo).toBe('trilha');
    expect(p.titulo).toBe('Matemática: Base numérica');
    expect(p.to).toBe('/materias/s%20mat');
  });

  it('revisão e cronograma continuam na frente da trilha', () => {
    expect(
      proximoPasso({ vencidas: 1, hoje: [], recomendacao: daTrilha }).tipo,
    ).toBe('revisao');
    expect(
      proximoPasso({ vencidas: 0, hoje: [sessao()], recomendacao: daTrilha })
        .tipo,
    ).toBe('cronograma');
  });
});
