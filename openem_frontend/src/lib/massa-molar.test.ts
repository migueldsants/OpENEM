import { describe, expect, it } from 'vitest';
import { lerFormula, massaMolar } from './massa-molar';

const SIMBOLOS = new Set(['H', 'He', 'C', 'N', 'O', 'Na', 'Cl', 'Ca', 'Cu', 'S', 'Fe', 'K', 'Co', 'Mg', 'P', 'Al']);
const MASSAS = new Map([
  ['H', 1.008],
  ['C', 12.011],
  ['N', 14.007],
  ['O', 15.999],
  ['Na', 22.99],
  ['Cl', 35.45],
  ['Ca', 40.078],
  ['Cu', 63.546],
  ['S', 32.06],
  ['Fe', 55.845],
  ['K', 39.098],
]);

function contagem(f: string) {
  const r = lerFormula(f, SIMBOLOS);
  if (!r.ok) throw new Error(r.erro);
  return Object.fromEntries(r.contagem);
}

function erro(f: string) {
  const r = lerFormula(f, SIMBOLOS);
  if (r.ok) throw new Error('era para dar erro');
  return r;
}

describe('leitura da fórmula', () => {
  it('lê elementos, índices e a ordem em que aparecem', () => {
    expect(contagem('H2O')).toEqual({ H: 2, O: 1 });
    expect(contagem('NaCl')).toEqual({ Na: 1, Cl: 1 });
    expect(contagem('C6H12O6')).toEqual({ C: 6, H: 12, O: 6 });
    const r = lerFormula('C6H12O6', SIMBOLOS);
    expect(r.ok && r.ordem).toEqual(['C', 'H', 'O']);
  });

  it('multiplica parênteses, colchetes e chaves', () => {
    expect(contagem('Ca(OH)2')).toEqual({ Ca: 1, O: 2, H: 2 });
    expect(contagem('K4[Fe(CN)6]')).toEqual({ K: 4, Fe: 1, C: 6, N: 6 });
    expect(contagem('{(CH3)2}3')).toEqual({ C: 6, H: 18 });
    expect(contagem('(NH4)2SO4')).toEqual({ N: 2, H: 8, S: 1, O: 4 });
  });

  it('soma as partes de um hidrato com o coeficiente', () => {
    expect(contagem('CuSO4·5H2O')).toEqual({ Cu: 1, S: 1, O: 9, H: 10 });
    expect(contagem('CuSO4.5H2O')).toEqual({ Cu: 1, S: 1, O: 9, H: 10 });
    expect(contagem('CuSO4*5H2O')).toEqual({ Cu: 1, S: 1, O: 9, H: 10 });
    expect(contagem('CaCl2·H2O')).toEqual({ Ca: 1, Cl: 2, H: 2, O: 1 });
    expect(contagem('2H2O')).toEqual({ H: 4, O: 2 });
  });

  it('aceita índices subscritos e espaços', () => {
    expect(contagem('H₂SO₄')).toEqual({ H: 2, S: 1, O: 4 });
    expect(contagem(' Na Cl ')).toEqual({ Na: 1, Cl: 1 });
    expect(contagem('C12H22O11')).toEqual({ C: 12, H: 22, O: 11 });
  });

  it('distingue Co (cobalto) de CO (carbono e oxigênio)', () => {
    expect(contagem('CO')).toEqual({ C: 1, O: 1 });
    expect(contagem('Co')).toEqual({ Co: 1 });
    expect(contagem('CO2')).toEqual({ C: 1, O: 2 });
  });

  it('explica o erro e diz onde está', () => {
    expect(erro('').erro).toBe('Digite uma fórmula.');
    expect(erro('Xy2')).toMatchObject({ erro: '"Xy" não é o símbolo de um elemento.', posicao: 0 });
    expect(erro('Ca(OH2')).toMatchObject({ erro: 'Falta fechar com ")".' });
    expect(erro('CaOH)2').erro).toBe('")" fecha um parêntese que não foi aberto.');
    expect(erro('h2o').erro).toBe('"h": o símbolo começa com letra maiúscula.');
    expect(erro('H0').erro).toBe('Índice zero.');
    expect(erro('()2').erro).toBe('Parênteses vazios.');
    expect(erro('CuSO4·').erro).toBe('Falta a fórmula depois do "·".');
    expect(erro('0H2O').erro).toBe('Coeficiente zero.');
    expect(erro('H2O+').erro).toBe('"+" não faz parte de uma fórmula.');
    expect(erro('(H2O)0').erro).toBe('Índice zero.');
    expect(erro('Ca(OH]2').erro).toBe('"]" fecha um parêntese que não foi aberto.');
  });
});

describe('massa molar', () => {
  it('soma as massas e dá a composição em massa', () => {
    const r = lerFormula('H2O', SIMBOLOS);
    if (!r.ok) throw new Error();
    const { total, parcelas } = massaMolar(r.contagem, r.ordem, MASSAS);
    expect(total).toBeCloseTo(18.015, 3);
    expect(parcelas.map((p) => p.simbolo)).toEqual(['H', 'O']);
    expect(parcelas[0]).toMatchObject({ atomos: 2, massaAtomica: 1.008 });
    expect(parcelas[0].massa).toBeCloseTo(2.016, 3);
    expect(parcelas[0].porcentagem).toBeCloseTo(11.19, 2);
    expect(parcelas[1].porcentagem).toBeCloseTo(88.81, 2);
  });

  it('dá a massa de um hidrato', () => {
    const r = lerFormula('CuSO4·5H2O', SIMBOLOS);
    if (!r.ok) throw new Error();
    expect(massaMolar(r.contagem, r.ordem, MASSAS).total).toBeCloseTo(249.68, 1);
  });

  it('sem nada, total zero e porcentagens zeradas', () => {
    expect(massaMolar(new Map(), [], MASSAS)).toEqual({ total: 0, parcelas: [] });
  });
});
