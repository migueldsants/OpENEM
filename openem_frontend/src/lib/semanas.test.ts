import { describe, expect, it } from 'vitest';
import {
  diaCurto,
  diaPorExtenso,
  estadoDoDia,
  formatarMinutos,
  fracaoDaMeta,
  intervaloDaSemana,
  metaDaSemana,
  motivoDaPrioridade,
  numeroDoDia,
  semAtividade,
  textoDaVariacao,
} from './semanas';

describe('datas da semana', () => {
  it('intervalo no mesmo mês e virando o mês', () => {
    expect(intervaloDaSemana('2026-10-19', '2026-10-25')).toBe('19 a 25 out');
    expect(intervaloDaSemana('2026-09-28', '2026-10-04')).toBe('28 set a 4 out');
  });

  it('dia curto, número e por extenso, sem depender do fuso', () => {
    expect(diaCurto('2026-10-19')).toBe('seg');
    expect(diaCurto('2026-10-25')).toBe('dom');
    expect(numeroDoDia('2026-10-05')).toBe(5);
    expect(diaPorExtenso('2026-10-21')).toBe('quarta, 21 de out');
  });
});

describe('meta e minutos', () => {
  it('meta da semana é a diária vezes sete; sem meta, nula', () => {
    expect(metaDaSemana(90)).toBe(630);
    expect(metaDaSemana(0)).toBeNull();
    expect(metaDaSemana(null)).toBeNull();
  });

  it('fração da meta fica entre 0 e 100', () => {
    expect(fracaoDaMeta(315, 630)).toBe(50);
    expect(fracaoDaMeta(900, 630)).toBe(100);
    expect(fracaoDaMeta(10, null)).toBe(0);
  });

  it('minutos legíveis', () => {
    expect(formatarMinutos(45)).toBe('45 min');
    expect(formatarMinutos(60)).toBe('1h');
    expect(formatarMinutos(90)).toBe('1h30');
    expect(formatarMinutos(125)).toBe('2h05');
  });
});

describe('variação e estado dos dias', () => {
  it('variação em pontos percentuais, com sinal de menos de verdade', () => {
    expect(textoDaVariacao(6)).toBe('+6 p.p.');
    expect(textoDaVariacao(-3)).toBe('−3 p.p.');
    expect(textoDaVariacao(0)).toBe('igual');
    expect(textoDaVariacao(null)).toBeNull();
  });

  it('estado de cada dia em relação a hoje (hoje mantém o contorno mesmo estudado)', () => {
    const hoje = '2026-10-21';
    expect(estadoDoDia({ date: '2026-10-20', studied: true }, hoje)).toBe('estudou');
    expect(estadoDoDia({ date: '2026-10-21', studied: false }, hoje)).toBe('hoje');
    expect(estadoDoDia({ date: '2026-10-21', studied: true }, hoje)).toBe('hoje-estudou');
    expect(estadoDoDia({ date: '2026-10-23', studied: false }, hoje)).toBe('futuro');
    expect(estadoDoDia({ date: '2026-10-19', studied: false }, hoje)).toBe('vazio');
  });

  it('sem atividade só quando nenhuma semana teve questão nem foco', () => {
    expect(semAtividade([{ answers: 0, minutes: 0 }, { answers: 0, minutes: 0 }])).toBe(true);
    expect(semAtividade([{ answers: 0, minutes: 25 }])).toBe(false);
  });

  it('motivo da prioridade cita a incidência na prova quando o peso é alto', () => {
    expect(motivoDaPrioridade({ correct: 1, answers: 4, weight: 5 })).toBe('1 de 4 certas · cai muito na prova');
    expect(motivoDaPrioridade({ correct: 2, answers: 6, weight: 3 })).toBe('2 de 6 certas');
  });
});
